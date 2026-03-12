import Solution from '../models/Solution.js';
import { ensureDb } from '../utils/db.js';

export const listSolutions = async (_req, res) => {
  try {
    await ensureDb();
    const items = await Solution.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createSolution = async (req, res) => {
  try {
    await ensureDb();
    const item = await Solution.create(req.body || {});
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateSolution = async (req, res) => {
  try {
    await ensureDb();
    const item = await Solution.findByIdAndUpdate(req.params.id, req.body || {}, { new: true }).lean();
    if (!item) return res.status(404).json({ message: 'Solution not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteSolution = async (req, res) => {
  try {
    await ensureDb();
    const item = await Solution.findByIdAndDelete(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'Solution not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
