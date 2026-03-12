import SupportTicket from '../models/SupportTicket.js';
import { ensureDb } from '../utils/db.js';

export const listTickets = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim();
    const filter = {};

    if (status) filter.status = status;
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ email: regex }, { category: regex }, { subject: regex }, { message: regex }];
    }

    const items = await SupportTicket.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    await ensureDb();
    const status = String(req.body.status || '').trim().toLowerCase();
    if (!['open', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const item = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ message: 'Ticket not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
