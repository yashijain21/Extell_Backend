import HomePageContent from '../models/HomePageContent.js';
import { ensureDb } from '../utils/db.js';

export const getHomePageContent = async (_req, res) => {
  try {
    await ensureDb();
    const content = await HomePageContent.findOne({}).lean();
    return res.json({ item: content || null });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateHomePageContent = async (req, res) => {
  try {
    await ensureDb();
    const payload = req.body || {};

    const updated = await HomePageContent.findOneAndUpdate({}, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }).lean();

    return res.json({ item: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
