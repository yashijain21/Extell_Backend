import Partner from '../models/Partner.js';
import { ensureDb } from '../utils/db.js';

export const listPublicPartners = async (_req, res) => {
  try {
    await ensureDb();

    const partners = await Partner.find({ status: 'active' })
      .select(
        'name slug companyName contactName email phone website address city state country loginEmail status partnerMarkupPercent portalNote createdAt updatedAt __v'
      )
      .sort({ companyName: 1 })
      .lean();

    return res.json({ success: true, data: { items: partners } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
