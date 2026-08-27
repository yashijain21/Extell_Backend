import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';
import Partner from '../models/Partner.js';
import PartnerUser from '../models/PartnerUser.js';
import PartnerLead from '../models/PartnerLead.js';
import PartnerQuote from '../models/PartnerQuote.js';
import PartnerQuoteItem from '../models/PartnerQuoteItem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const seedsDir = path.resolve(rootDir, 'backend/seeds');

dotenv.config({ path: path.resolve(rootDir, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'Extell';

const collectionPlan = [
  { file: 'products.json', model: Product },
  { file: 'partners.json', model: Partner },
  { file: 'partner_users.json', model: PartnerUser },
  { file: 'partner_leads.json', model: PartnerLead },
  { file: 'partner_quotes.json', model: PartnerQuote },
  { file: 'partner_quote_items.json', model: PartnerQuoteItem }
];

const upsertDocuments = async (model, docs = []) => {
  let inserted = 0;
  let updated = 0;

  for (const doc of docs) {
    if (!doc || !doc._id) {
      throw new Error(`Seed document for ${model.modelName} is missing _id.`);
    }

    const result = await model.replaceOne({ _id: doc._id }, doc, { upsert: true });
    if (result.upsertedCount) inserted += 1;
    else if (result.modifiedCount) updated += 1;
  }

  return { inserted, updated, total: docs.length };
};

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is missing. Set it in .env before running the seed script.');
  }

  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });

  for (const entry of collectionPlan) {
    const filePath = path.resolve(seedsDir, entry.file);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error(`Invalid seed file format in ${entry.file}: expected an array.`);
    }

    const result = await upsertDocuments(entry.model, parsed);
    // eslint-disable-next-line no-console
    console.log(
      `${entry.file}: processed=${result.total} inserted=${result.inserted} updated=${result.updated}`
    );
  }

  // eslint-disable-next-line no-console
  console.log('Partner module seed completed successfully.');
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Partner module seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.disconnect();
    }
  });
