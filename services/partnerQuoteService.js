import mongoose from 'mongoose';
import Product from '../models/Product.js';
import PartnerQuote from '../models/PartnerQuote.js';
import PartnerQuoteItem from '../models/PartnerQuoteItem.js';
import Partner from '../models/Partner.js';
import { buildProductSnapshot, normalizeText, toNumber } from '../utils/partnerHelpers.js';

const QUOTE_PREFIX = 'QT';

const getYearPrefix = (date = new Date()) => date.getFullYear();

const generateQuoteNumber = async (quoteDate = new Date()) => {
  const year = getYearPrefix(quoteDate);
  const prefix = `${QUOTE_PREFIX}-${year}-`;
  const lastQuote = await PartnerQuote.findOne({ quoteNumber: new RegExp(`^${prefix}`) })
    .sort({ quoteNumber: -1 })
    .select({ quoteNumber: 1 })
    .lean();

  const lastSequence = lastQuote?.quoteNumber
    ? Number(String(lastQuote.quoteNumber).slice(prefix.length))
    : 0;

  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`;
};

const normalizeQuoteItems = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: item.productId || item.product || item._id || item.id || null,
      quantity: toNumber(item.quantity, 1)
    }))
    .filter((item) => item.productId && item.quantity > 0);

const validatePartnerQuotePayload = (payload = {}, partner = null) => {
  const customerName = normalizeText(
    payload.customerName ||
      payload.name ||
      partner?.contactName ||
      partner?.companyName ||
      partner?.name ||
      ''
  );
  const customerEmail = normalizeText(payload.customerEmail || payload.email || '').toLowerCase();
  const customerPhone = normalizeText(payload.customerPhone || payload.phone || '');
  const companyName = normalizeText(payload.companyName || '');
  const fallbackItems = Array.isArray(partner?.assignedProductIds) ? partner.assignedProductIds : [];
  const items = normalizeQuoteItems(payload.items || payload.products || fallbackItems.map((productId) => ({
    productId,
    quantity: 1
  })));

  if (!customerName || !items.length) {
    throw new Error('A customer name and at least one product are required.');
  }

  return {
    customerName,
    customerEmail,
    customerPhone,
    companyName,
    items,
    currency: normalizeText(payload.currency || 'INR') || 'INR',
    status: ['draft', 'sent', 'accepted', 'rejected'].includes(normalizeText(payload.status))
      ? normalizeText(payload.status)
      : 'draft'
  };
};

const buildPartnerQuoteSlip = (quote, { label = 'Payment Slip' } = {}) => ({
  slipNumber: quote.quoteNumber,
  label,
  partnerId: quote.partnerId,
  quoteId: quote._id,
  quoteNumber: quote.quoteNumber,
  customerName: quote.customerName,
  companyName: quote.companyName,
  currency: quote.currency,
  items: (quote.items || []).map((item) => ({
    productId: item.productId || null,
    productName: item.productName,
    sku: item.sku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
    amountDue: item.lineTotal
  })),
  subtotal: quote.subtotal,
  markupPercent: quote.markupPercent,
  markupAmount: quote.markupAmount,
  total: quote.total,
  amountDue: quote.total,
  status: 'awaiting_payment',
  generatedAt: quote.createdAt || new Date()
});

const preparePartnerQuoteData = async ({ partnerId, payload = {}, markupPercentOverride }) => {
  if (!mongoose.Types.ObjectId.isValid(String(partnerId || ''))) {
    throw new Error('Invalid partner reference.');
  }

  const partner = await Partner.findById(partnerId).lean();
  if (!partner) {
    throw new Error('Partner not found.');
  }

  const parsed = validatePartnerQuotePayload(payload, partner);
  const markupPercent = toNumber(
    markupPercentOverride ?? payload.markupPercent ?? partner.partnerMarkupPercent ?? 0,
    0
  );

  const productIds = parsed.items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const items = parsed.items.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) {
      throw new Error(`Product not found for ${item.productId}.`);
    }

    return buildProductSnapshot(product, item.quantity, markupPercent);
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const markupAmount = subtotal * (markupPercent / 100);
  const total = subtotal + markupAmount;

  return {
    partner,
    parsed,
    markupPercent,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    markupAmount: Number(markupAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

export const buildPartnerQuote = async ({ partnerId, createdBy, payload = {}, markupPercentOverride }) => {
  const { parsed, markupPercent, items, subtotal, markupAmount, total } =
    await preparePartnerQuoteData({ partnerId, payload, markupPercentOverride });

  const quoteNumber = await generateQuoteNumber();

  const quote = await PartnerQuote.create({
    partnerId,
    quoteNumber,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,
    companyName: parsed.companyName,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    markupPercent,
    markupAmount: Number(markupAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
    currency: parsed.currency,
    status: parsed.status,
    createdBy: createdBy && mongoose.Types.ObjectId.isValid(String(createdBy)) ? createdBy : null
  });

  const itemDocs = items.map((item) => ({
    quoteId: quote._id,
    partnerId,
    productId: item.productId,
    productName: item.productName,
    sku: item.sku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal
  }));

  if (itemDocs.length) {
    await PartnerQuoteItem.insertMany(itemDocs);
  }

  return quote;
};

export const previewPartnerQuote = async ({ partnerId, payload = {}, markupPercentOverride }) => {
  const { parsed, markupPercent, items, subtotal, markupAmount, total, partner } =
    await preparePartnerQuoteData({ partnerId, payload, markupPercentOverride });

  const quoteNumber = await generateQuoteNumber();

  return {
    partnerId: partner._id,
    quoteNumber,
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,
    companyName: parsed.companyName,
    items,
    subtotal,
    markupPercent,
    markupAmount,
    total,
    currency: parsed.currency,
    status: parsed.status,
    slip: buildPartnerQuoteSlip(
      {
        _id: null,
        partnerId: partner._id,
        quoteNumber,
        customerName: parsed.customerName,
        companyName: parsed.companyName,
        items,
        subtotal,
        markupPercent,
        markupAmount,
        total,
        currency: parsed.currency,
        createdAt: new Date()
      },
      { label: 'Partner Payment Slip' }
    )
  };
};

export const listPartnerQuotesWithItems = async (filter = {}) => PartnerQuote.find(filter).sort({ createdAt: -1 }).lean();

export { buildPartnerQuoteSlip };
