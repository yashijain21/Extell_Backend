import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import SupportTicket from './models/SupportTicket.js';
import adminRoutes from './routes/adminRoutes.js';
import { ensureDb, USE_DB } from './utils/db.js';
import { ensureDefaultAdmin } from './controllers/adminAuthController.js';
import { createWarrantyRegistration } from './controllers/warrantyController.js';
import { createQuoteRequest } from './controllers/quoteController.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const SUPPORT_TICKET_TO = process.env.SUPPORT_TICKET_TO || 'yashijain935@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'no-reply@extell.local';
const SMTP_CONN_TIMEOUT_MS = Number(process.env.SMTP_CONN_TIMEOUT_MS) || 8000;
const SMTP_GREET_TIMEOUT_MS = Number(process.env.SMTP_GREET_TIMEOUT_MS) || 8000;
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 10000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_API_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';
const RESEND_FROM = process.env.RESEND_FROM || SMTP_FROM;

app.use(cors());
app.use(express.json());
const LIST_PROJECTION = {
  _id: 1,
  id: 1,
  ID: 1,
  Type: 1,
  SKU: 1,
  Name: 1,
  Published: 1,
  'Is featured?': 1,
  'In stock?': 1,
  Categories: 1,
  category: 1,
  Images: 1,
  heroImage: 1,
  short: 1,
  descriptionText: 1,
  specs: 1,
  detailRows: 1,
  infoSections: 1,
  features: 1,
  datasheet: 1,
  downloadUrl: 1,
  certificationUrl: 1,
  infoPdfUrl: 1,
  contactUrl: 1,
  createdAt: 1
};

const fallbackProducts = [
  {
    _id: 'fallback-e001gir31',
    ID: 2276,
    Type: 'simple',
    SKU: 'E001GIR31',
    Name: 'Galaxy Internal Rack Mount 1 To 3KVA, Online UPS',
    Published: 1,
    'Is featured?': 0,
    'In stock?': 1,
    Categories: 'UPS > Single Phase Online RT, UPS',
    descriptionText:
      'ExTell Galaxy is a premium range online Double Conversion Single Phase UPS with internal batteries and backup time expansion capacity.',
    Images:
      'https://extellsystems.com/wp-content/uploads/2025/08/E001GIR31_Front-Hero-2-scaled.png, https://extellsystems.com/wp-content/uploads/2025/08/E001GIR31_Rear-scaled.png',
    datasheet:
      'https://extellsystems.com/wp-content/uploads/2025/11/ExTell-Galaxy_Series_Internal-UPS_1-to-3kVA_Rack-Mount.pdf',
    detailRows: [
      { parameter: 'Model', value: 'E003SPIR31' },
      { parameter: 'Capacity', value: '3000VA / 3000W' },
      { parameter: 'Nominal Voltage', value: '208/220/230/240Vac' },
      { parameter: 'Battery Number', value: '6' }
    ],
    features: [
      'Short Lead Time',
      'Unity Power Factor',
      'Rack-Tower deployment compatible',
      'Expandable Backup Time',
      'Advanced Smart Management'
    ]
  }
];

const slugify = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const slugifyLegacy = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MAIN_CATEGORY_ORDER = [
  'BATTERY',
  'COPPER ACCESSORIES',
  'COPPER CABLES',
  'ELEVATOR CABLES',
  'FIBER ACCESSORIES',
  'FIBER CABLES',
  'PDU',
  'RACK ACCESSORIES',
  'RACKS AND CABINETS',
  'TELECOM IP RACKS',
  'UPS',
  'UPS ACCESSORIES'
];

const MAIN_CATEGORY_ORDER_INDEX = new Map(MAIN_CATEGORY_ORDER.map((name, index) => [name, index]));

const normalizeCategoryText = (value = '') => slugify(value).replace(/-/g, ' ');

const resolveMainCategory = (topCategory, fullCategoryText = '') => {
  const inputs = [topCategory, fullCategoryText]
    .filter(Boolean)
    .map((value) => normalizeCategoryText(value));

  for (const input of inputs) {
    if (input.includes('ups accessories') || input.includes('ups accessory')) return 'UPS ACCESSORIES';
    if (input.includes('telecom ip racks') || input.includes('telecom ip rack')) return 'TELECOM IP RACKS';
    if (input.includes('racks and cabinets') || input.includes('rack and cabinet')) return 'RACKS AND CABINETS';
    if (input.includes('rack accessories') || input.includes('rack accessory')) return 'RACK ACCESSORIES';
    if (input.includes('fiber accessories') || input.includes('fiber accessory')) return 'FIBER ACCESSORIES';
    if (input.includes('fiber cables') || input.includes('fiber cable')) return 'FIBER CABLES';
    if (input.includes('copper accessories') || input.includes('copper accessory')) return 'COPPER ACCESSORIES';
    if (input.includes('copper cables') || input.includes('copper cable')) return 'COPPER CABLES';
    if (input.includes('elevator cables') || input.includes('elevator cable')) return 'ELEVATOR CABLES';
    if (input.includes('battery') || input.includes('batteries')) return 'BATTERY';
    if (input.includes('pdu') || input.includes('power distribution unit')) return 'PDU';
    if (input.includes('ups')) return 'UPS';
  }

  const explicit = String(topCategory || '').trim().toUpperCase();
  if (MAIN_CATEGORY_ORDER_INDEX.has(explicit)) return explicit;

  return String(topCategory || '').trim() || 'Uncategorized';
};

const sortCategories = (list = []) =>
  [...list].sort((a, b) => {
    const aIdx = MAIN_CATEGORY_ORDER_INDEX.has(a.name) ? MAIN_CATEGORY_ORDER_INDEX.get(a.name) : Number.MAX_SAFE_INTEGER;
    const bIdx = MAIN_CATEGORY_ORDER_INDEX.has(b.name) ? MAIN_CATEGORY_ORDER_INDEX.get(b.name) : Number.MAX_SAFE_INTEGER;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.name.localeCompare(b.name);
  });

const parseTopCategory = (doc) => {
  const categoryText = String(doc.Categories || doc.category || '').trim();
  if (!categoryText) return 'Uncategorized';
  const first = (categoryText.split('>')[0] || categoryText).split(',')[0] || categoryText;
  return resolveMainCategory(first.trim(), categoryText);
};

const parseImageList = (doc) => {
  if (Array.isArray(doc.Images)) return doc.Images.filter(Boolean);
  if (typeof doc.Images === 'string') {
    return doc.Images
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const toBool = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
};

const passesBaseFilters = (item, { q, type, inStock, featured, published }) => {
  const haystack = `${item.Name || ''} ${item.SKU || ''} ${item.Description || ''} ${item.descriptionText || ''}`.toLowerCase();
  if (q && !haystack.includes(q.toLowerCase())) return false;
  if (type && String(item.Type || '') !== type) return false;
  if (inStock !== undefined && Boolean(item['In stock?'] ?? item.inStock) !== inStock) return false;
  if (featured !== undefined && Boolean(item['Is featured?'] ?? item.isFeatured) !== featured) return false;
  if (published !== undefined && Boolean(item.Published ?? item.isPublished) !== published) return false;
  return true;
};

const normalizeProduct = (doc) => {
  const topCategory = parseTopCategory(doc);
  const images = parseImageList(doc);
  const id = String(doc._id || doc.id || doc.ID || doc.SKU || '');

  return {
    ...doc,
    id,
    topCategory,
    categorySlug: slugify(topCategory),
    imageList: images,
    heroImage: doc.heroImage || images[0] || '',
    inStock: Boolean(doc['In stock?'] ?? doc.inStock),
    isFeatured: Boolean(doc['Is featured?'] ?? doc.isFeatured),
    isPublished: Boolean(doc.Published ?? doc.published)
  };
};

const buildCategoryBuckets = (items) => {
  const map = new Map();
  for (const item of items) {
    const slug = item.categorySlug || 'uncategorized';
    const current = map.get(slug) || {
      name: item.topCategory || 'Uncategorized',
      slug,
      count: 0
    };
    current.count += 1;
    map.set(slug, current);
  }
  return sortCategories(Array.from(map.values()));
};

const buildSupportCategoryHierarchy = (docs = []) => {
  const groupMap = new Map();

  for (const doc of docs) {
    const categoryText = String(doc.Categories || doc.category || '').trim();
    if (!categoryText) continue;

    const primaryPath = categoryText.split(',')[0].trim();
    const parts = primaryPath
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) continue;

    const main = resolveMainCategory(parts[0], categoryText);
    const sub = parts[1] || '';

    if (!groupMap.has(main)) {
      groupMap.set(main, new Set());
    }
    if (sub) {
      groupMap.get(main).add(sub);
    }
  }

  const groups = Array.from(groupMap.entries()).map(([name, subSet]) => ({
    name,
    subcategories: Array.from(subSet).sort((a, b) => a.localeCompare(b))
  }));

  return sortCategories(groups);
};

const applySort = (items, sortBy) => {
  const list = [...items];
  switch (sortBy) {
    case 'name-asc':
      return list.sort((a, b) => String(a.Name || a.name || '').localeCompare(String(b.Name || b.name || '')));
    case 'name-desc':
      return list.sort((a, b) => String(b.Name || b.name || '').localeCompare(String(a.Name || a.name || '')));
    case 'newest':
      return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    case 'featured':
    default:
      return list.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
  }
};



let supportTransportPromise;
const createSupportTransport = async () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const nodemailerModule = await import('nodemailer');
  const nodemailer = nodemailerModule.default || nodemailerModule;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    connectionTimeout: SMTP_CONN_TIMEOUT_MS,
    greetingTimeout: SMTP_GREET_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

const getSupportTransport = async () => {
  if (!supportTransportPromise) {
    supportTransportPromise = createSupportTransport().catch((error) => {
      supportTransportPromise = null;
      throw error;
    });
  }
  return supportTransportPromise;
};

const normalizeFromEmail = (fromValue = '') => {
  const match = String(fromValue).match(/<([^>]+)>/);
  return (match ? match[1] : fromValue).trim();
};

const sendViaResend = async ({ subject, text, replyTo }) => {
  if (!RESEND_API_KEY) return false;
  const payload = {
    from: RESEND_FROM,
    to: [SUPPORT_TICKET_TO],
    subject,
    text,
    reply_to: replyTo
  };
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API failed (${response.status}): ${body}`);
  }
  return true;
};

const sendTicketNotification = async (ticket) => {
  const subject = `[Support Ticket] ${ticket.priority.toUpperCase()} - ${ticket.category}`;
  const text = [
    'A new support ticket has been submitted.',
    `Ticket ID: ${ticket._id}`,
    `Email: ${ticket.email}`,
    `Mobile: ${ticket.mobile || 'N/A'}`,
    `Serial Number: ${ticket.serialNumber || 'N/A'}`,
    `Category: ${ticket.category}`,
    `Priority: ${ticket.priority}`,
    `Description: ${ticket.description}`,
    `Attachments: ${(ticket.attachmentNames || []).join(', ') || 'None'}`
  ].join('\n');

  const transport = await getSupportTransport().catch(() => null);
  if (transport) {
    try {
      await transport.sendMail({
        from: SMTP_FROM,
        to: SUPPORT_TICKET_TO,
        replyTo: ticket.email,
        subject,
        text
      });
      return true;
    } catch (smtpError) {
      // Try Resend as fallback on SMTP network/auth issues.
      if (!RESEND_API_KEY) throw smtpError;
      await sendViaResend({
        subject,
        text,
        replyTo: normalizeFromEmail(ticket.email)
      });
      return true;
    }
  }

  if (!RESEND_API_KEY) return false;
  await sendViaResend({
    subject,
    text,
    replyTo: normalizeFromEmail(ticket.email)
  });

  return true;
};

app.get('/api/health', async (_req, res) => {
  try {
    await ensureDb();
    return res.json({
      ok: true,
      dbConnected: mongoose.connection.readyState === 1
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    await ensureDb();
    const docs = USE_DB ? await Product.find({}, { Categories: 1, category: 1 }, { maxTimeMS: 12000 }).lean() : fallbackProducts;
    const normalized = docs.map(normalizeProduct);
    return res.json({ items: buildCategoryBuckets(normalized) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/support/categories', async (_req, res) => {
  try {
    await ensureDb();
    const docs = USE_DB
      ? await Product.find({}, { Categories: 1, category: 1 }, { maxTimeMS: 12000 }).lean()
      : fallbackProducts;

    return res.json({ items: buildSupportCategoryHierarchy(docs) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/grouped-by-category', async (req, res) => {
  try {
    await ensureDb();
    const q = String(req.query.q || '').trim();
    const docs = USE_DB
      ? await Product.find(
          q
            ? { $or: [{ Name: new RegExp(escapeRegex(q), 'i') }, { SKU: new RegExp(escapeRegex(q), 'i') }] }
            : {},
          LIST_PROJECTION,
          { maxTimeMS: 12000 }
        ).lean()
      : fallbackProducts.filter((item) => passesBaseFilters(item, { q }));
    const normalized = docs.map(normalizeProduct);
    const grouped = normalized.reduce((acc, item) => {
      const slug = item.categorySlug || 'uncategorized';
      if (!acc[slug]) {
        acc[slug] = {
          name: item.topCategory || 'Uncategorized',
          slug,
          count: 0,
          items: []
        };
      }
      acc[slug].count += 1;
      acc[slug].items.push(item);
      return acc;
    }, {});

    return res.json({ items: sortCategories(Object.values(grouped)) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    await ensureDb();

    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const sortBy = String(req.query.sort || 'featured');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(60, Number(req.query.limit) || 12));
    const type = String(req.query.type || '').trim();
    const inStock = toBool(req.query.inStock);
    const featured = toBool(req.query.featured);
    const published = toBool(req.query.published);

    const mongoQuery = {};
    const criteria = { q, type, inStock, featured, published };

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      mongoQuery.$or = [{ Name: regex }, { SKU: regex }, { Description: regex }, { descriptionText: regex }];
    }
    if (type) mongoQuery.Type = type;
    if (inStock !== undefined) mongoQuery['In stock?'] = inStock ? { $in: [1, true, '1'] } : { $in: [0, false, '0'] };
    if (featured !== undefined) {
      mongoQuery['Is featured?'] = featured ? { $in: [1, true, '1'] } : { $in: [0, false, '0'] };
    }
    if (published !== undefined) mongoQuery.Published = published ? { $in: [1, true, '1'] } : { $in: [0, false, '0'] };

    const docs = USE_DB
      ? await Product.find(mongoQuery, LIST_PROJECTION, { maxTimeMS: 15000 }).lean()
      : fallbackProducts.filter((item) => passesBaseFilters(item, criteria));
    let items = docs.map(normalizeProduct);

    if (category) {
      const categorySlug = slugify(category);
      items = items.filter(
        (item) =>
          item.categorySlug === categorySlug ||
          slugify(item.topCategory).includes(categorySlug) ||
          slugify(item.Categories || '').includes(categorySlug)
      );
    }

    const sorted = applySort(items, sortBy);
    const total = sorted.length;
    const start = (page - 1) * limit;
    const paged = sorted.slice(start, start + limit);

    const allCategories = buildCategoryBuckets(items);
    const allTypes = Array.from(new Set(items.map((item) => item.Type).filter(Boolean))).sort();

    return res.json({
      items: paged,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        categories: allCategories,
        types: allTypes
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/slug/:slug', async (req, res) => {
  try {
    await ensureDb();
    const { slug } = req.params;
    const normalizedSlug = slugify(slug);
    const normalizedLegacySlug = slugifyLegacy(slug);
    if (!normalizedSlug) return res.status(400).json({ message: 'Invalid slug' });

    if (USE_DB) {
      const docs = await Product.find({}, LIST_PROJECTION, { maxTimeMS: 15000 }).lean();
      const found = docs.find((doc) => {
        const name = doc?.Name || doc?.name || '';
        return slugify(name) === normalizedSlug || slugifyLegacy(name) === normalizedLegacySlug;
      });
      if (!found) return res.status(404).json({ message: 'Product not found' });
      return res.json({ item: normalizeProduct(found) });
    }

    const found = fallbackProducts.find((item) => {
      const name = item?.Name || item?.name || '';
      return slugify(name) === normalizedSlug || slugifyLegacy(name) === normalizedLegacySlug;
    });
    if (!found) return res.status(404).json({ message: 'Product not found' });
    return res.json({ item: normalizeProduct(found) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;

    const queryCandidates = [{ id }, { SKU: id }, { ID: Number.isNaN(Number(id)) ? id : Number(id) }];
    if (mongoose.Types.ObjectId.isValid(id)) queryCandidates.unshift({ _id: id });

    const doc = USE_DB
      ? await Product.findOne({ $or: queryCandidates }).lean()
      : fallbackProducts.find((item) =>
          [item._id, item.id, item.SKU, String(item.ID)].map((value) => String(value || '')).includes(String(id))
        );
    if (!doc) return res.status(404).json({ message: 'Product not found' });

    return res.json({ item: normalizeProduct(doc) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/warranty/register', async (req, res) => {
  try {
    if (!USE_DB) {
      return res.status(503).json({ message: 'Database is not configured for warranty registrations.' });
    }

    return createWarrantyRegistration(req, res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

app.post('/api/quotes', async (req, res) => {
  try {
    if (!USE_DB) {
      return res.status(503).json({ message: 'Database is not configured for quote requests.' });
    }

    await ensureDb();
    return createQuoteRequest(req, res);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
app.post('/api/support/tickets', async (req, res) => {
  try {
    if (!USE_DB) {
      return res
        .status(503)
        .json({ message: 'Database is not configured for support tickets.' });
    }

    await ensureDb();

    const payload = req.body || {};

    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    const mobile = String(payload.mobile || '').trim();
    const subject = String(payload.subject || '').trim();
    const message = String(payload.message || '').trim();
    const serialNumber = String(payload.serialNumber || '').trim();
    const category = String(payload.category || '').trim();
    const priority = String(payload.priority || 'normal').trim().toLowerCase();
    const description = String(payload.description || '').trim();
    const attachmentNames = Array.isArray(payload.attachmentNames)
      ? payload.attachmentNames.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const attachmentUrls = Array.isArray(payload.attachmentUrls)
      ? payload.attachmentUrls.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    // Required validation
    if (!email || !mobile || !category || !description) {
      return res.status(400).json({
        message: 'Email, mobile number, product category, and issue description are required.'
      });
    }

    if (!['normal', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority value.' });
    }

    const ticket = await SupportTicket.create({
      name,
      email,
      mobile,
      subject,
      message: message || description,
      serialNumber,
      category,
      priority,
      description,
      attachmentNames,
      attachmentUrls,
      status: 'open'
    });

    return res.status(201).json({
      success: true,
      item: ticket
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${PORT}`);
  ensureDefaultAdmin().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seed default admin:', error.message);
  });
});


