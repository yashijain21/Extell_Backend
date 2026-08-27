import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';

export const normalizeText = (value = '') => String(value || '').trim();

export const normalizeEmail = (value = '') => normalizeText(value).toLowerCase();

export const normalizePhone = (value = '') => normalizeText(value);

export const slugify = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildGeneratedSubdomain = (slug = '') => {
  const normalizedSlug = slugify(slug);
  return normalizedSlug ? `${normalizedSlug}.extellsystems.com` : '';
};

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(lowered)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(lowered)) return false;
  }
  return Boolean(value);
};

export const normalizeObjectIdList = (value = []) => {
  const items = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

  return Array.from(
    new Set(
      items
        .map((entry) => String(entry || '').trim())
        .filter((entry) => mongoose.Types.ObjectId.isValid(entry))
    )
  ).map((entry) => new mongoose.Types.ObjectId(entry));
};

export const normalizePartnerPayload = (payload = {}) => {
  const companyName = normalizeText(payload.companyName || payload.name || '');
  const contactName = normalizeText(payload.contactName || '');
  const name = normalizeText(payload.name || companyName || contactName || '');
  const slug = slugify(payload.slug || companyName || name || '');
  const email = normalizeEmail(payload.email || '');
  const phone = normalizePhone(payload.phone || '');
  const website = normalizeText(payload.website || '');
  const loginEmail = normalizeEmail(payload.loginEmail || email || '');
  const loginPassword = normalizeText(payload.loginPassword || payload.password || '');
  const partnerMarkupPercent = toNumber(
    payload.partnerMarkupPercent ?? payload.markupPercent ?? 0,
    0
  );
  const assignedProductIds = normalizeObjectIdList(payload.assignedProductIds || []);
  const customDomainEnabled = toBoolean(payload.customDomainEnabled || Boolean(website));
  const generatedSubdomain = customDomainEnabled ? '' : buildGeneratedSubdomain(slug);

  return {
    name,
    slug,
    companyName: companyName || name,
    contactName,
    email,
    phone,
    website,
    address: normalizeText(payload.address || ''),
    city: normalizeText(payload.city || ''),
    state: normalizeText(payload.state || ''),
    country: normalizeText(payload.country || 'India'),
    loginEmail,
    loginPassword,
    status: ['active', 'pending', 'suspended'].includes(normalizeText(payload.status))
      ? normalizeText(payload.status)
      : 'pending',
    partnerMarkupPercent,
    assignedProductIds,
    generatedSubdomain,
    customDomainEnabled,
    portalNote: normalizeText(payload.portalNote || '')
  };
};

export const hashPassword = async (value) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(value || ''), salt);
};

export const comparePassword = async (value, hash) => bcrypt.compare(String(value || ''), String(hash || ''));

export const generateTemporaryPassword = (length = 12) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#';
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

export const extractProductPrice = (product = {}) => {
  const candidates = [
    product.unitPrice,
    product.price,
    product.salePrice,
    product.sellingPrice,
    product.listPrice,
    product.mrp,
    product.MRP,
    product.Price,
    product.basePrice,
    product.BasePrice
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) return value;
  }

  return 0;
};

export const buildProductSnapshot = (product = {}, quantity = 1, markupPercent = 0) => {
  const unitPrice = extractProductPrice(product);
  const qty = Math.max(toNumber(quantity, 1), 1);
  const lineTotal = unitPrice * qty;
  const markupAmount = lineTotal * (toNumber(markupPercent, 0) / 100);

  return {
    productId: product._id || product.id || null,
    productName: normalizeText(product.Name || product.name || ''),
    sku: normalizeText(product.SKU || product.sku || ''),
    unitPrice,
    quantity: qty,
    lineTotal,
    markupAmount: Number(markupAmount.toFixed(2))
  };
};
