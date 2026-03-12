import Admin from '../models/Admin.js';
import { ensureDb } from '../utils/db.js';

export const listAdmins = async (_req, res) => {
  try {
    await ensureDb();
    const admins = await Admin.find({}, '-password').sort({ createdAt: -1 }).lean();
    return res.json({ items: admins });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createAdmin = async (req, res) => {
  try {
    await ensureDb();
    const { name = '', email = '', password = '', role = 'admin' } = req.body || {};

    if (!name.trim() || !email.trim() || !password.trim()) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existing) {
      return res.status(409).json({ message: 'An admin with this email already exists.' });
    }

    const admin = new Admin({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password.trim(),
      role: role || 'admin'
    });

    await admin.save();
    const safeAdmin = admin.toObject();
    delete safeAdmin.password;

    return res.status(201).json({ item: safeAdmin });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
