import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { ensureDb } from '../utils/db.js';

const slugify = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const normalizeNode = (node = {}) => {
  const name = String(node.name || '').trim();
  if (!name) return null;
  const children = Array.isArray(node.children)
    ? node.children.map(normalizeNode).filter(Boolean)
    : [];
  return { name, children };
};

const buildTreePayload = (docs = []) => {
  const tree = {};
  const items = [];

  docs.forEach((doc) => {
    const root = String(doc.name || '').trim();
    if (!root) return;
    items.push(root);

    const level1 = [];
    const level2 = {};
    const level3 = {};

    const firstLevelNodes = Array.isArray(doc.subcategories) ? doc.subcategories : [];
    firstLevelNodes.forEach((node) => {
      const l1 = String(node?.name || '').trim();
      if (!l1) return;
      level1.push(l1);

      const secondLevelNodes = Array.isArray(node?.children) ? node.children : [];
      level2[l1] = secondLevelNodes.map((entry) => String(entry?.name || '').trim()).filter(Boolean);

      secondLevelNodes.forEach((entry) => {
        const l2 = String(entry?.name || '').trim();
        if (!l2) return;
        const key = `${l1} > ${l2}`;
        const thirdLevelNodes = Array.isArray(entry?.children) ? entry.children : [];
        level3[key] = thirdLevelNodes.map((third) => String(third?.name || '').trim()).filter(Boolean);
      });
    });

    tree[root] = { level1, level2, level3 };
  });

  return { items: items.sort((a, b) => a.localeCompare(b)), tree };
};

export const listAdminCategories = async (_req, res) => {
  try {
    await ensureDb();
    const docs = await Category.find({}).sort({ name: 1 }).lean();

    if (docs.length) {
      return res.json(buildTreePayload(docs));
    }

    // Fallback for existing setups before categories are seeded.
    const [primary, legacy] = await Promise.all([Product.distinct('category'), Product.distinct('Categories')]);
    const merged = [...primary, ...legacy]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    const unique = Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b));
    return res.json({ items: unique, tree: {} });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createAdminCategory = async (req, res) => {
  try {
    await ensureDb();
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required.' });

    const normalized = Array.isArray(req.body?.subcategories)
      ? req.body.subcategories.map(normalizeNode).filter(Boolean)
      : [];

    const doc = await Category.create({
      name,
      slug: slugify(name),
      subcategories: normalized
    });
    return res.status(201).json({ item: doc });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateAdminCategory = async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Category name is required.' });

    const normalized = Array.isArray(req.body?.subcategories)
      ? req.body.subcategories.map(normalizeNode).filter(Boolean)
      : [];

    const updated = await Category.findByIdAndUpdate(
      id,
      { name, slug: slugify(name), subcategories: normalized },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ message: 'Category not found.' });
    return res.json({ item: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAdminCategory = async (req, res) => {
  try {
    await ensureDb();
    const { id } = req.params;
    const removed = await Category.findByIdAndDelete(id).lean();
    if (!removed) return res.status(404).json({ message: 'Category not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
