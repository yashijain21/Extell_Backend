import jwt from 'jsonwebtoken';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import Admin from '../models/Admin.js';
import PasswordResetOtp from '../models/PasswordResetOtp.js';
import { ensureDb } from '../utils/db.js';
import { sendEmail } from '../services/mailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const signToken = (admin) =>
  jwt.sign({ id: admin._id, role: admin.role, email: admin.email, name: admin.name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

export const requestAdminPasswordReset = async (req, res) => {
  try {
    await ensureDb();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const admin = await Admin.findOne({ email }).select('_id').lean();
    if (admin) {
      const existingOtp = await PasswordResetOtp.findOne({ email }).lean();
      if (!existingOtp || Date.now() - new Date(existingOtp.createdAt).getTime() >= 60_000) {
        const otp = String(randomInt(0, 10_000)).padStart(4, '0');
        const expiresAt = new Date(Date.now() + 10 * 60_000);
        await PasswordResetOtp.findOneAndUpdate(
          { email },
          {
            $set: {
              otpHash: createHash('sha256').update(otp).digest('hex'),
              attempts: 0,
              expiresAt,
              createdAt: new Date()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        try {
      await sendEmail({
            to: email,
            subject: 'Your Extell admin password reset code',
            passcode: otp,
            time: `${expiresAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`,
            text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`
          });
        } catch (error) {
          await PasswordResetOtp.deleteOne({ email });
          throw error;
        }
      }
    }

    return res.json({ message: 'If an admin account exists for this email, a password reset code has been sent.' });
  } catch (error) {
    console.error('Admin password reset email failed:', error);
    return res.status(500).json({ message: 'Unable to send a password reset code right now.' });
  }
};

export const resetAdminPasswordWithOtp = async (req, res) => {
  try {
    await ensureDb();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4}$/.test(otp) || !newPassword) {
      return res.status(400).json({ message: 'Email, four-digit code, and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    const resetRecord = await PasswordResetOtp.findOne({ email }).exec();
    if (!resetRecord || resetRecord.expiresAt <= new Date() || resetRecord.attempts >= 5) {
      return res.status(400).json({ message: 'The code is invalid or expired. Request a new code.' });
    }

    const expectedHash = Buffer.from(resetRecord.otpHash, 'hex');
    const receivedHash = createHash('sha256').update(otp).digest();
    if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) {
      resetRecord.attempts += 1;
      await resetRecord.save();
      return res.status(400).json({ message: 'The code is invalid or expired.' });
    }

    const admin = await Admin.findOne({ email }).exec();
    if (!admin) {
      await PasswordResetOtp.deleteOne({ email });
      return res.status(400).json({ message: 'The code is invalid or expired.' });
    }

    admin.password = newPassword;
    await admin.save();
    await PasswordResetOtp.deleteOne({ email });
    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (error) {
    console.error('Admin password reset with OTP failed:', error);
    return res.status(500).json({ message: 'Unable to reset the password right now.' });
  }
};

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

export const resetAdminPassword = async (req, res) => {
  try {
    await ensureDb();
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old password and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    const admin = await Admin.findById(req.user?.id).exec();
    if (!admin) return res.status(404).json({ message: 'Admin not found.' });

    const isMatch = await admin.comparePassword(oldPassword);
    if (!isMatch) return res.status(401).json({ message: 'Old password is incorrect.' });

    admin.password = newPassword;
    await admin.save();
    return res.json({ message: 'Password updated successfully.' });
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
