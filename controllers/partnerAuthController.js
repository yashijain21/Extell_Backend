import jwt from 'jsonwebtoken';
import Partner from '../models/Partner.js';
import PartnerUser from '../models/PartnerUser.js';
import { ensureDb } from '../utils/db.js';
import { comparePassword } from '../utils/partnerHelpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const signToken = ({ partnerId, userId, role, email, name }) =>
  jwt.sign({ partnerId, userId, role, email, name }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

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
