import mongoose from 'mongoose';

const PARTNERS_COLLECTION = process.env.PARTNERS_COLLECTION || 'partners';

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    country: { type: String, default: 'India', trim: true },
    loginEmail: { type: String, default: '', trim: true, lowercase: true },
    loginPasswordHash: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'pending', 'suspended'],
      default: 'pending',
      index: true
    },
    partnerMarkupPercent: { type: Number, default: 0, min: 0 },
    assignedProductIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }
    ],
    generatedSubdomain: { type: String, default: '', trim: true, index: true },
    customDomainEnabled: { type: Boolean, default: false },
    portalNote: { type: String, default: '', trim: true }
  },
  {
    timestamps: true,
    collection: PARTNERS_COLLECTION
  }
);

partnerSchema.index({ companyName: 1 });

const Partner = mongoose.models.Partner || mongoose.model('Partner', partnerSchema);

export default Partner;
