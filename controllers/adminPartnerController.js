import mongoose from 'mongoose';
import Partner from '../models/Partner.js';
import PartnerUser from '../models/PartnerUser.js';
import PartnerLead from '../models/PartnerLead.js';
import PartnerQuote from '../models/PartnerQuote.js';
import PartnerQuoteItem from '../models/PartnerQuoteItem.js';
import Product from '../models/Product.js';
import { ensureDb } from '../utils/db.js';
import {
  generateTemporaryPassword,
  hashPassword,
  normalizeEmail,
  normalizePartnerPayload,
  normalizeText
} from '../utils/partnerHelpers.js';
import { buildPartnerQuote } from '../services/partnerQuoteService.js';

const ensureUniqueSlug = async (baseSlug, excludeId = null) => {
  const normalizedBase = normalizeText(baseSlug).toLowerCase();
  const candidateBase = normalizedBase || 'partner';
  let candidate = candidateBase;
  let counter = 2;

  while (await Partner.exists({
    slug: candidate,
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  })) {
    candidate = `${candidateBase}-${counter}`;
    counter += 1;
  }

  return candidate;
};

const mergePartnerDoc = async (payload = {}, existingPartner = null) => {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
  const normalized = normalizePartnerPayload({
    ...(existingPartner || {}),
    ...cleanPayload
  });

  const slug = await ensureUniqueSlug(normalized.slug || existingPartner?.slug || normalized.name, existingPartner?._id);
  const existingAssigned = Array.isArray(existingPartner?.assignedProductIds)
    ? existingPartner.assignedProductIds
    : [];
  const hasAssignedProducts = Object.prototype.hasOwnProperty.call(cleanPayload, 'assignedProductIds');
  const assignedProductIds = hasAssignedProducts
    ? normalized.assignedProductIds
    : existingAssigned;
  const hasLoginEmail = Object.prototype.hasOwnProperty.call(cleanPayload, 'loginEmail');
  const hasLoginPassword = Object.prototype.hasOwnProperty.call(cleanPayload, 'loginPassword');

  return {
    name: normalized.name || existingPartner?.name || normalized.companyName,
    slug,
    companyName: normalized.companyName || existingPartner?.companyName || normalized.name,
    contactName: normalized.contactName || existingPartner?.contactName || '',
    email: normalized.email || existingPartner?.email || '',
    phone: normalized.phone || existingPartner?.phone || '',
    website: normalized.website || existingPartner?.website || '',
    address: normalized.address || existingPartner?.address || '',
    city: normalized.city || existingPartner?.city || '',
    state: normalized.state || existingPartner?.state || '',
    country: normalized.country || existingPartner?.country || 'India',
    loginEmail: hasLoginEmail ? normalized.loginEmail : existingPartner?.loginEmail || '',
    loginPassword: hasLoginPassword ? normalized.loginPassword : '',
    status: normalized.status || existingPartner?.status || 'pending',
    partnerMarkupPercent: normalized.partnerMarkupPercent ?? existingPartner?.partnerMarkupPercent ?? 0,
    assignedProductIds,
    generatedSubdomain: normalized.customDomainEnabled
      ? ''
      : normalized.generatedSubdomain || existingPartner?.generatedSubdomain || '',
    customDomainEnabled: normalized.customDomainEnabled,
    portalNote: normalized.portalNote || existingPartner?.portalNote || ''
  };
};

const syncPrimaryPartnerUser = async (partner, { plainPassword = '', passwordHash = '', updatePassword = false } = {}) => {
  const loginEmail = normalizeEmail(partner.loginEmail || partner.email || '');
  if (!loginEmail) return null;

  const primaryName = normalizeText(partner.contactName || partner.companyName || partner.name || 'Partner User');
  const existingUser = await PartnerUser.findOne({
    partnerId: partner._id,
    role: 'partner_admin'
  }).sort({ createdAt: 1 });

  const nextPasswordHash = updatePassword
    ? passwordHash || (plainPassword ? await hashPassword(plainPassword) : existingUser?.passwordHash || '')
    : existingUser?.passwordHash || passwordHash || (plainPassword ? await hashPassword(plainPassword) : '');

  if (existingUser) {
    existingUser.name = primaryName;
    existingUser.email = loginEmail;
    if (nextPasswordHash) existingUser.passwordHash = nextPasswordHash;
    existingUser.isActive = true;
    await existingUser.save();
    return existingUser;
  }

  if (!nextPasswordHash) {
    throw new Error('A partner password is required to create the first partner admin user.');
  }

  const user = new PartnerUser({
    partnerId: partner._id,
    name: primaryName,
    email: loginEmail,
    passwordHash: nextPasswordHash,
    role: 'partner_admin',
    isActive: true
  });
  await user.save();
  return user;
};

export const listAdminPartners = async (req, res) => {
  try {
    await ensureDb();
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { name: regex },
        { companyName: regex },
        { contactName: regex },
        { email: regex },
        { loginEmail: regex },
        { slug: regex }
      ];
    }
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      Partner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Partner.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data: {
        items,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdminPartnerById = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    const [users, leadsCount, quotesCount, products] = await Promise.all([
      PartnerUser.find({ partnerId: partner._id }).sort({ createdAt: 1 }).lean(),
      PartnerLead.countDocuments({ partnerId: partner._id }),
      PartnerQuote.countDocuments({ partnerId: partner._id }),
      Product.find({ _id: { $in: partner.assignedProductIds || [] } }).lean()
    ]);

    return res.json({
      success: true,
      data: {
        partner,
        users,
        products,
        stats: {
          leadsCount,
          quotesCount,
          assignedProductsCount: (partner.assignedProductIds || []).length
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createAdminPartner = async (req, res) => {
  try {
    await ensureDb();
    const data = await mergePartnerDoc(req.body || {});

    if (!data.name || !data.companyName) {
      return res.status(400).json({
        success: false,
        message: 'Partner name and company name are required.'
      });
    }

    if (data.loginPassword) {
      data.loginPasswordHash = await hashPassword(data.loginPassword);
    } else {
      data.loginPasswordHash = '';
    }
    delete data.loginPassword;

    const partner = await Partner.create(data);
    const savedUser = data.loginEmail && data.loginPasswordHash
      ? await syncPrimaryPartnerUser(partner, {
          passwordHash: data.loginPasswordHash,
          updatePassword: true
        })
      : null;

    return res.status(201).json({
      success: true,
      data: {
        partner,
        user: savedUser
          ? {
              id: savedUser._id,
              partnerId: savedUser.partnerId,
              name: savedUser.name,
              email: savedUser.email,
              role: savedUser.role
            }
          : null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAdminPartner = async (req, res) => {
  try {
    await ensureDb();
    const existingPartner = await Partner.findById(req.params.id).lean();
    if (!existingPartner) {
      return res.status(404).json({ success: false, message: 'Partner not found.' });
    }

    const data = await mergePartnerDoc(req.body || {}, existingPartner);
    if (data.loginPassword) {
      data.loginPasswordHash = await hashPassword(data.loginPassword);
    } else {
      data.loginPasswordHash = existingPartner.loginPasswordHash || '';
    }
    delete data.loginPassword;

    const updated = await Partner.findByIdAndUpdate(req.params.id, data, { new: true }).lean();
    const savedUser = await syncPrimaryPartnerUser(updated, {
      passwordHash: data.loginPasswordHash,
      updatePassword: Boolean(req.body?.loginPassword)
    }).catch(() => null);

    return res.json({
      success: true,
      data: {
        partner: updated,
        user: savedUser
          ? {
              id: savedUser._id,
              partnerId: savedUser.partnerId,
              name: savedUser.name,
              email: savedUser.email,
              role: savedUser.role
            }
          : null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAdminPartner = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    await Promise.all([
      PartnerUser.deleteMany({ partnerId: partner._id }),
      PartnerLead.deleteMany({ partnerId: partner._id }),
      PartnerQuoteItem.deleteMany({ partnerId: partner._id }),
      PartnerQuote.deleteMany({ partnerId: partner._id }),
      Partner.deleteOne({ _id: partner._id })
    ]);

    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const invitePartnerUser = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    const loginEmail = normalizeEmail(req.body?.loginEmail || partner.loginEmail || partner.email || '');
    if (!loginEmail) {
      return res.status(400).json({ success: false, message: 'A login email is required.' });
    }

    const tempPassword = normalizeText(req.body?.password || generateTemporaryPassword());
    const passwordHash = await hashPassword(tempPassword);

    partner.loginEmail = loginEmail;
    partner.loginPasswordHash = passwordHash;
    await partner.save();

    const user = await syncPrimaryPartnerUser(partner, {
      passwordHash,
      updatePassword: true
    });

    return res.json({
      success: true,
      data: {
        partnerId: partner._id,
        loginEmail,
        temporaryPassword: tempPassword,
        user: {
          id: user._id,
          partnerId: user.partnerId,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPartnerPassword = async (req, res) => {
  try {
    await ensureDb();
    const partner = await Partner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found.' });

    const loginEmail = normalizeEmail(partner.loginEmail || partner.email || '');
    if (!loginEmail) {
      return res.status(400).json({ success: false, message: 'Partner does not have a login email.' });
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    partner.loginEmail = loginEmail;
    partner.loginPasswordHash = passwordHash;
    await partner.save();

    const user = await syncPrimaryPartnerUser(partner, {
      passwordHash,
      updatePassword: true
    });

    return res.json({
      success: true,
      data: {
        partnerId: partner._id,
        loginEmail,
        temporaryPassword: tempPassword,
        user: user
          ? {
              id: user._id,
              partnerId: user.partnerId,
              name: user.name,
              email: user.email,
              role: user.role
            }
          : null
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listAdminPartnerLeads = async (req, res) => {
  try {
    await ensureDb();
    const filter = {};
    const partnerId = String(req.query.partnerId || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    if (partnerId && mongoose.Types.ObjectId.isValid(partnerId)) filter.partnerId = partnerId;
    if (status) filter.status = status;

    const items = await PartnerLead.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const listAdminPartnerQuotes = async (req, res) => {
  try {
    await ensureDb();
    const filter = {};
    const partnerId = String(req.query.partnerId || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    if (partnerId && mongoose.Types.ObjectId.isValid(partnerId)) filter.partnerId = partnerId;
    if (status) filter.status = status;

    const items = await PartnerQuote.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateAdminPartnerQuote = async (req, res) => {
  try {
    await ensureDb();
    const partnerId = String(req.body?.partnerId || '').trim();
    if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: 'A valid partnerId is required.' });
    }

    const quote = await buildPartnerQuote({
      partnerId,
      createdBy: null,
      payload: req.body || {},
      markupPercentOverride: req.body?.markupPercent
    });

    return res.status(201).json({
      success: true,
      data: { quote }
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
