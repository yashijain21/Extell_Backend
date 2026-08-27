import Partner from '../models/Partner.js';
import PartnerLead from '../models/PartnerLead.js';
import PartnerQuote from '../models/PartnerQuote.js';
import Product from '../models/Product.js';
import PartnerUser from '../models/PartnerUser.js';
import { ensureDb } from '../utils/db.js';
import { buildPartnerQuote } from '../services/partnerQuoteService.js';

export const listPartnerProducts = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.user?.partnerId).lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    const items = await Product.find({ _id: { $in: partner.assignedProductIds || [] } })
      .sort({ Name: 1, createdAt: -1 })
      .lean();

    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listPartnerLeads = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.query.status || '').trim().toLowerCase();
    const filter = { partnerId: req.user?.partnerId };
    if (status) filter.status = status;

    const items = await PartnerLead.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listPartnerQuotes = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.query.status || '').trim().toLowerCase();
    const filter = { partnerId: req.user?.partnerId };
    if (status) filter.status = status;

    const items = await PartnerQuote.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPartnerQuote = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.user?.partnerId).lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    const quote = await buildPartnerQuote({
      partnerId: partner._id,
      createdBy: req.user?.userId || null,
      payload: req.body || {},
      markupPercentOverride: partner.partnerMarkupPercent
    });

    return res.status(201).json({ success: true, data: { quote } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
