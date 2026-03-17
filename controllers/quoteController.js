import QuoteRequest from '../models/QuoteRequest.js';
import { ensureDb } from '../utils/db.js';

const ALLOWED_STATUS = ['new', 'contacted', 'quoted', 'closed'];

export const createQuoteRequest = async (req, res) => {
  try {
    await ensureDb();

    const payload = req.body || {};
    const fullName = String(payload.fullName || payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const companyName = String(payload.companyName || '').trim();
    const requirements = String(payload.requirements || payload.message || '').trim();
    const productName = String(payload.productName || '').trim();
    const productSku = String(payload.productSku || '').trim();
    const source = String(payload.source || '').trim() || 'product-detail';

    if (!fullName || !email || !requirements) {
      return res.status(400).json({ message: 'Full name, email, and requirements are required.' });
    }

    const item = await QuoteRequest.create({
      fullName,
      email,
      companyName,
      requirements,
      productName,
      productSku,
      source,
      status: 'new'
    });

    return res.status(201).json({ success: true, item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listQuoteRequests = async (req, res) => {
  try {
    await ensureDb();

    const status = String(req.query.status || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim();

    const filter = {};
    if (status && ALLOWED_STATUS.includes(status)) filter.status = status;
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { fullName: regex },
        { email: regex },
        { companyName: regex },
        { productName: regex },
        { productSku: regex },
        { requirements: regex }
      ];
    }

    const items = await QuoteRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateQuoteStatus = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const item = await QuoteRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ message: 'Quote request not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
