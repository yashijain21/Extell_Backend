import Partner from '../models/Partner.js';
import Product from '../models/Product.js';
import { ensureDb } from '../utils/db.js';

const PUBLIC_PRODUCT_FIELDS = [
  '_id', 'id', 'ID', 'Type', 'SKU', 'Name', 'Published', 'Is featured?', 'In stock?',
  'Categories', 'category', 'Images', 'heroImage', 'short', 'descriptionText', 'specs',
  'detailRows', 'infoSections', 'features', 'datasheet', 'downloadUrl', 'certificationUrl',
  'infoPdfUrl', 'contactUrl', 'createdAt'
].join(' ');

const normalizePublicProduct = (product) => {
  const images = Array.isArray(product.Images)
    ? product.Images.filter(Boolean)
    : String(product.Images || '').split(/[\n,]+/).map((image) => image.trim()).filter(Boolean);

  return {
    ...product,
    id: String(product._id || product.id || product.ID || product.SKU || ''),
    imageList: images,
    heroImage: product.heroImage || images[0] || '',
    inStock: Boolean(product['In stock?'] ?? product.inStock),
    isFeatured: Boolean(product['Is featured?'] ?? product.isFeatured),
    isPublished: Boolean(product.Published ?? product.published ?? product.isPublished)
  };
};

export const listPublicPartners = async (_req, res) => {
  try {
    await ensureDb();

    const partners = await Partner.find({ status: 'active' })
      .select('name slug companyName website city state country assignedProductIds')
      .sort({ companyName: 1 })
      .lean();

    const productIds = [...new Set(partners.flatMap((partner) => partner.assignedProductIds || []).map(String))];
    const products = productIds.length
      ? await Product.find({
          _id: { $in: productIds },
          $or: [{ Published: true }, { Published: 1 }, { isPublished: true }, { published: true }]
        }).select(PUBLIC_PRODUCT_FIELDS).lean()
      : [];
    const productsById = new Map(products.map((product) => [String(product._id), normalizePublicProduct(product)]));

    const items = partners.map(({ assignedProductIds = [], ...partner }) => ({
      ...partner,
      products: assignedProductIds
        .map((id) => productsById.get(String(id)))
        .filter(Boolean)
    }));

    return res.json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
