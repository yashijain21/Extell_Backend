import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { ensureDb } from '../utils/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const signToken = (admin) =>
  jwt.sign({ id: admin._id, role: admin.role, email: admin.email, name: admin.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

export const loginAdmin = async (req, res) => {
  try {
    await ensureDb();
    const { email = '', password = '' } = req.body || {};
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const admin = await Admin.findOne({ email: normalizedEmail }).exec();
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await admin.comparePassword(String(password));
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = signToken(admin);
    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    await ensureDb();
    const admin = await Admin.findById(req.user?.id).select('-password').lean();
    if (!admin) return res.status(404).json({ message: 'Admin not found.' });
    return res.json({ admin });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const ensureDefaultAdmin = async () => {
  const seedEmail = String(process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const seedPassword = String(process.env.ADMIN_SEED_PASSWORD || '').trim();
  const seedName = String(process.env.ADMIN_SEED_NAME || 'Admin');

  if (!seedEmail || !seedPassword) return null;

  await ensureDb();
  const existing = await Admin.findOne({ email: seedEmail }).exec();
  if (existing) return existing;

  const admin = new Admin({
    name: seedName,
    email: seedEmail,
    password: seedPassword,
    role: 'admin'
  });
  await admin.save();
  return admin;
};
