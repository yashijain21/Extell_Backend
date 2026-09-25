import jwt from 'jsonwebtoken';
import { createHash, randomInt } from 'crypto';
import Partner from '../models/Partner.js';
import PartnerUser from '../models/PartnerUser.js';
import PasswordResetOtp from '../models/PasswordResetOtp.js';
import { ensureDb } from '../utils/db.js';
import { comparePassword } from '../utils/partnerHelpers.js';
import { sendEmail } from '../services/mailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const signToken = ({ partnerId, userId, role, email, name }) =>
  jwt.sign({ partnerId, userId, role, email, name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

const hashOtp = (otp) => createHash('sha256').update(otp).digest('hex');

export const requestPartnerPasswordReset = async (req, res) => {
  try {
    await ensureDb();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }

    const user = await PartnerUser.findOne({ email }).select('_id').lean();
    const partner = user ? null : await Partner.findOne({
      loginEmail: email,
      loginPasswordHash: { $ne: '' }
    }).select('_id').lean();

    // Avoid disclosing whether an account exists, and throttle repeat requests.
    if (user || partner) {
      const existingOtp = await PasswordResetOtp.findOne({ email }).lean();
      if (!existingOtp || Date.now() - new Date(existingOtp.createdAt).getTime() >= 60_000) {
        const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const expiresAt = new Date(Date.now() + 10 * 60_000);
        await PasswordResetOtp.findOneAndUpdate(
          { email },
          { $set: { otpHash: hashOtp(otp), expiresAt, createdAt: new Date() } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        try {
          await sendEmail({
            to: email,
            subject: 'Your Extell password reset code',
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

    return res.json({ success: true, message: 'If an account exists for this email, a password reset code has been sent.' });
  } catch (error) {
    console.error('Partner password reset email failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to send a password reset code right now.' });
  }
};

export const loginPartner = async (req, res) => {
  try {
    await ensureDb();

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const partnerUser = await PartnerUser.findOne({ email }).lean();
    if (partnerUser) {
      if (!partnerUser.isActive) {
        return res.status(403).json({ success: false, message: 'This account is disabled.' });
      }

      const isMatch = await comparePassword(password, partnerUser.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      await PartnerUser.updateOne({ _id: partnerUser._id }, { $set: { lastLoginAt: new Date() } });
      const partner = await Partner.findById(partnerUser.partnerId).lean();

      const token = signToken({
        partnerId: String(partnerUser.partnerId),
        userId: String(partnerUser._id),
        role: partnerUser.role,
        email: partnerUser.email,
        name: partnerUser.name
      });

      return res.json({
        success: true,
        data: {
          token,
          partner: partner
            ? {
                id: partner._id,
                name: partner.name,
                companyName: partner.companyName,
                slug: partner.slug,
                status: partner.status,
                generatedSubdomain: partner.generatedSubdomain,
                customDomainEnabled: partner.customDomainEnabled
              }
            : null,
          user: {
            id: partnerUser._id,
            partnerId: partnerUser.partnerId,
            name: partnerUser.name,
            email: partnerUser.email,
            role: partnerUser.role
          }
        }
      });
    }

    const partner = await Partner.findOne({
      loginEmail: email,
      loginPasswordHash: { $ne: '' }
    }).lean();

    if (!partner) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await comparePassword(password, partner.loginPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = signToken({
      partnerId: String(partner._id),
      userId: null,
      role: 'partner_admin',
      email: partner.loginEmail || partner.email || '',
      name: partner.contactName || partner.companyName || partner.name
    });

    return res.json({
      success: true,
      data: {
        token,
        partner: {
          id: partner._id,
          name: partner.name,
          companyName: partner.companyName,
          slug: partner.slug,
          status: partner.status,
          generatedSubdomain: partner.generatedSubdomain,
          customDomainEnabled: partner.customDomainEnabled
        },
        user: null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPartnerMe = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.user?.partnerId).lean();
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found.' });
    }

    let user = null;
    if (req.user?.userId) {
      user = await PartnerUser.findById(req.user.userId).lean();
    }

    return res.json({
      success: true,
      data: {
        partner: {
          id: partner._id,
          name: partner.name,
          slug: partner.slug,
          companyName: partner.companyName,
          contactName: partner.contactName,
          email: partner.email,
          phone: partner.phone,
          website: partner.website,
          address: partner.address,
          city: partner.city,
          state: partner.state,
          country: partner.country,
          loginEmail: partner.loginEmail,
          status: partner.status,
          partnerMarkupPercent: partner.partnerMarkupPercent,
          assignedProductIds: partner.assignedProductIds,
          generatedSubdomain: partner.generatedSubdomain,
          customDomainEnabled: partner.customDomainEnabled,
          portalNote: partner.portalNote,
          createdAt: partner.createdAt,
          updatedAt: partner.updatedAt
        },
        user: user
          ? {
              id: user._id,
              partnerId: user.partnerId,
              name: user.name,
              email: user.email,
              role: user.role,
              isActive: user.isActive,
              lastLoginAt: user.lastLoginAt
            }
          : null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
