import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Category from '../models/Category.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const jsonPath = path.resolve(rootDir, 'categories.from-master-list.json');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'Extell';

const normalizeNode = (node = {}) => {
  const name = String(node.name || '').trim();
  if (!name) return null;
  const children = Array.isArray(node.children)
    ? node.children.map(normalizeNode).filter(Boolean)
    : [];
  return { name, children };
};

const normalizeCategoryDoc = (doc = {}) => {
  const name = String(doc.name || '').trim();
  const slug = String(doc.slug || '').trim();
  if (!name || !slug) return null;
  const subcategories = Array.isArray(doc.subcategories)
    ? doc.subcategories.map(normalizeNode).filter(Boolean)
    : [];
  return { name, slug, subcategories };
};

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Set it in your .env file.');
  }

  const raw = await fs.readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid JSON format: expected an array of categories.');
  }

  const categories = parsed.map(normalizeCategoryDoc).filter(Boolean);
  if (!categories.length) {
    throw new Error('No valid categories found in JSON.');
  }

  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });

  let inserted = 0;
  let updated = 0;

  for (const item of categories) {
    const result = await Category.updateOne(
      { slug: item.slug },
      { $set: item },
      { upsert: true }
    );
    if (result.upsertedCount) inserted += 1;
    else if (result.modifiedCount) updated += 1;
  }

  console.log(`Processed: ${categories.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log('Done: categories collection is seeded.');
};

run()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });
