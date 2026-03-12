import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'Extell';

const USE_DB = Boolean(MONGODB_URI);

export const ensureDb = async () => {
  if (!USE_DB) return;
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
};

export { USE_DB };
