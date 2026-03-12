import Project from '../models/Project.js';
import { ensureDb } from '../utils/db.js';

export const listProjects = async (_req, res) => {
  try {
    await ensureDb();
    const items = await Project.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createProject = async (req, res) => {
  try {
    await ensureDb();
    const item = await Project.create(req.body || {});
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    await ensureDb();
    const item = await Project.findByIdAndUpdate(req.params.id, req.body || {}, { new: true }).lean();
    if (!item) return res.status(404).json({ message: 'Project not found.' });
    return res.json({ item });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    await ensureDb();
    const item = await Project.findByIdAndDelete(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'Project not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
