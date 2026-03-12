import Resource from '../models/Resource.js';
import { ensureDb } from '../utils/db.js';

export const listResources = async (_req, res) => {
  try {
    await ensureDb();
    const items = await Resource.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createResource = async (req, res) => {
  try {
    await ensureDb();
    const item = await Resource.create(req.body || {});
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteResource = async (req, res) => {
  try {
    await ensureDb();
    const item = await Resource.findByIdAndDelete(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'Resource not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
