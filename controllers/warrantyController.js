import WarrantyRegistration from '../models/WarrantyRegistration.js';
import { ensureDb } from '../utils/db.js';

const ALLOWED_STATUS = ['pending', 'in-progress', 'approved', 'rejected'];

export const createWarrantyRegistration = async (req, res) => {
  try {
    await ensureDb();

    const payload = req.body || {};
    const productName = String(payload.productName || '').trim();
    const mobile = String(payload.mobile || '').trim();
    const invoiceId = String(payload.invoiceId || '').trim();
    const customerName = String(payload.customerName || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const serialNumber = String(payload.serialNumber || '').trim();
    const notes = String(payload.notes || '').trim();
    const purchaseDate = payload.purchaseDate ? new Date(payload.purchaseDate) : null;

    if (!productName || !mobile || !invoiceId) {
      return res.status(400).json({ message: 'Product name, mobile number, and invoice id are required.' });
    }

    if (Number.isNaN(purchaseDate?.getTime())) {
      return res.status(400).json({ message: 'Invalid purchase date provided.' });
    }

    const item = await WarrantyRegistration.create({
      customerName,
      productName,
      mobile,
      email,
      invoiceId,
      serialNumber,
      purchaseDate,
      notes,
      status: 'pending'
    });

    return res.status(201).json({ success: true, item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listWarrantyRegistrations = async (req, res) => {
  try {
    await ensureDb();

    const status = String(req.query.status || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim();

    const filter = {};
    if (status && ALLOWED_STATUS.includes(status)) {
      filter.status = status;
    }
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { productName: regex },
        { invoiceId: regex },
        { mobile: regex },
        { customerName: regex },
        { email: regex },
        { serialNumber: regex }
      ];
    }

    const items = await WarrantyRegistration.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateWarrantyStatus = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.body.status || '').trim().toLowerCase();

    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const item = await WarrantyRegistration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ message: 'Warranty registration not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
