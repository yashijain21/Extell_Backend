import mongoose from 'mongoose';

const COLLECTION_NAME = process.env.COLLECTION_NAME || 'Products';

const productSchema = new mongoose.Schema({}, { strict: false, collection: COLLECTION_NAME });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

export default Product;
