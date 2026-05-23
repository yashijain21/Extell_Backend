import mongoose from "mongoose";
import Product from "../models/Product.js";
import { ensureDb } from "../utils/db.js";

const splitCategoryPath = (value) =>
  String(value || '')
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);

const buildCategoryPath = ({ category = '', subCategory1 = '', subCategory2 = '', subCategory3 = '' }) =>
  [category, subCategory1, subCategory2, subCategory3]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

const normalizeImageList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeFeatures = (value) => {
  if (!value) return [];

  // Already object shaped
  if (Array.isArray(value) && value.every((item) => item && typeof item === 'object')) {
    return value
      .map((item) => ({
        title: String(item.title || item.name || '').trim(),
        detail: String(item.detail || item.description || '').trim()
      }))
      .filter((item) => item.title || item.detail);
  }

  // Array of strings
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((title) => ({ title, detail: '' }));
  }

  // Comma-separated string
  if (typeof value === "string") {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((title) => ({ title, detail: '' }));
  }
  return [];
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(lowered)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(lowered)) return false;
  }
  return Boolean(value);
};

const mapPayloadToProduct = (payload = {}) => {
  const name = payload.name ?? payload.Name ?? '';
  const sku = payload.sku ?? payload.SKU ?? payload.id ?? '';
  const modelNumber =
    payload.modelNumber ??
    payload.ModelNumber ??
    payload.model_number ??
    payload.modelNo ??
    '';
  const rawCategory = payload.category ?? payload.Categories ?? '';
  const parsedPath = splitCategoryPath(rawCategory);
  const category = String(payload.rootCategory ?? parsedPath[0] ?? '').trim();
  const subCategory1 = String(payload.subCategory1 ?? parsedPath[1] ?? '').trim();
  const subCategory2 = String(payload.subCategory2 ?? parsedPath[2] ?? '').trim();
  const subCategory3 = String(payload.subCategory3 ?? parsedPath[3] ?? '').trim();
  const categoryPath = buildCategoryPath({ category, subCategory1, subCategory2, subCategory3 });
  const categoryString = categoryPath.join(' > ');
  const description = payload.description ?? payload.descriptionText ?? '';
  const specifications = payload.specifications ?? payload.specs ?? payload.detailRows ?? {};
  const features = normalizeFeatures(payload.features ?? payload.Features ?? []);
  const images = normalizeImageList(payload.images ?? payload.Images ?? []);
  const datasheet = payload.datasheet ?? payload.dataSheet ?? payload.Datasheet ?? '';
  const heroImage = payload.heroImage ?? payload.hero_image ?? payload.heroImageUrl ?? '';
  const contactUrl = payload.contactUrl ?? payload.contact_url ?? '';
  const isFeatured = toBool(payload.isFeatured ?? payload['Is featured?'] ?? payload.featured ?? false);

  const updateDoc = {
    ...payload,
    Name: name,
    SKU: sku,
    sku: sku,
    modelNumber,
    ModelNumber: modelNumber,
    category: categoryString,
    Categories: categoryString,
    subCategory1,
    subCategory2,
    subCategory3,
    descriptionText: description,
    specs: specifications,
    features,
    Images: images,
    datasheet: datasheet,
    Datasheet: datasheet,
    heroImage,
    contactUrl,
    isFeatured,
    featured: isFeatured,
    'Is featured?': isFeatured ? 1 : 0
  };

  return updateDoc;
};

export const listAdminProducts = async (req, res) => {
  try {
    await ensureDb();
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const subCategory1 = String(req.query.subCategory1 || '').trim();
    const subCategory2 = String(req.query.subCategory2 || '').trim();
    const subCategory3 = String(req.query.subCategory3 || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { Name: regex },
        { SKU: regex },
        { modelNumber: regex },
        { ModelNumber: regex },
        { descriptionText: regex }
      ];
    }
    if (category) {
      filter.$or = [
        { category: category },
        { Categories: new RegExp(category, 'i') }
      ];
    }
    if (subCategory1) filter.subCategory1 = subCategory1;
    if (subCategory2) filter.subCategory2 = subCategory2;
    if (subCategory3) filter.subCategory3 = subCategory3;

    const [result] = await Product.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ])
      .allowDiskUse(true)
      .exec();

    const items = result?.items || [];
    const total = result?.totalCount?.[0]?.count || 0;

    return res.json({ items, total, page, limit });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createAdminProduct = async (req, res) => {
  try {
    await ensureDb();
    const payload = req.body || {};
    const updateDoc = mapPayloadToProduct(payload);
    if (!updateDoc.createdAt) updateDoc.createdAt = new Date();

    const product = await Product.create(updateDoc);
    return res.status(201).json({ item: product });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateAdminProduct = async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const payload = req.body || {};
    const updateDoc = mapPayloadToProduct(payload);

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };
    const updated = await Product.findOneAndUpdate(query, updateDoc, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: 'Product not found.' });
    return res.json({ item: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAdminProduct = async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };
    const removed = await Product.findOneAndDelete(query).lean();
    if (!removed) return res.status(404) .json({ message: 'Product not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listAdminCategories = async (_req, res) => {
  try {
    await ensureDb();
    // Combine categories from both modern `category` and legacy `Categories` fields,
    // then deduplicate and sort for consistent dropdown display.
    const [primary, legacy] = await Promise.all([
      Product.distinct('category'),
      Product.distinct('Categories')
    ]);

    const merged = [...primary, ...legacy]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const unique = Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b));

    return res.json({ items: unique });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


