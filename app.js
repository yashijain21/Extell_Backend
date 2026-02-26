import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'Extell';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'Products';

app.use(cors());
app.use(express.json());

const productSchema = new mongoose.Schema({}, { strict: false, collection: COLLECTION_NAME });
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
const USE_DB = Boolean(MONGODB_URI);
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
  features: 1,
  datasheet: 1,
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

const ensureDb = async () => {
  if (!USE_DB) return;
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${PORT}`);
});
