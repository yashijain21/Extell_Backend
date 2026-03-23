import mongoose from "mongoose";
import Product from "../models/Product.js";
import { ensureDb } from "../utils/db.js";

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

const mapPayloadToProduct = (payload = {}) => {
  const name = payload.name ?? payload.Name ?? '';
  const category = payload.category ?? payload.Categories ?? '';
  const description = payload.description ?? payload.descriptionText ?? '';
  const specifications = payload.specifications ?? payload.specs ?? payload.detailRows ?? {};
  const images = normalizeImageList(payload.images ?? payload.Images ?? []);
  const datasheet = payload.datasheet ?? payload.dataSheet ?? '';
  const heroImage = payload.heroImage ?? payload.hero_image ?? payload.heroImageUrl ?? '';
  const contactUrl = payload.contactUrl ?? payload.contact_url ?? '';

  const updateDoc = {
    ...payload,
    Name: name,
    category: category,
    Categories: payload.Categories || payload.category || payload.Categories || category,
    descriptionText: description,
    specs: specifications,
    Images: images,
    datasheet: datasheet,
    heroImage,
    contactUrl
  };

  return updateDoc;
};

export const listAdminProducts = async (req, res) => {
  try {
    await ensureDb();
    const q = String(req.query.q || '').trim();
    const category = String(req.query.category || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};
    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [{ Name: regex }, { SKU: regex }, { descriptionText: regex }];
    }
    if (category) {
      filter.$or = [
        { category: category },
        { Categories: new RegExp(category, 'i') }
      ];
    }

    // Use indexed sort to prevent MongoDB in-memory sort from exceeding 32MB
    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true) // opt into external sort when needed
        .lean(),
      Product.countDocuments(filter)
    ]);

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
    if (!removed) return res.status(404).json({ message: 'Product not found.' });
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
