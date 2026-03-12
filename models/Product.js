import mongoose from 'mongoose';

const COLLECTION_NAME = process.env.COLLECTION_NAME || 'Products';

// Keep documents flexible but add timestamps so we can sort on an indexed field
const productSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    collection: COLLECTION_NAME,
    timestamps: true // adds createdAt/updatedAt
  }
);

// Index createdAt to avoid in-memory sorts that hit the 32MB limit
productSchema.index({ createdAt: -1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
