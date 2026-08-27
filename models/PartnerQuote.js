import mongoose from 'mongoose';

const PARTNER_QUOTES_COLLECTION = process.env.PARTNER_QUOTES_COLLECTION || 'partner_quotes';

const partnerQuoteItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, default: '', trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const partnerQuoteSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    quoteNumber: { type: String, required: true, unique: true, trim: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '', trim: true, lowercase: true },
    customerPhone: { type: String, default: '', trim: true },
    companyName: { type: String, default: '', trim: true },
    items: { type: [partnerQuoteItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    markupPercent: { type: Number, default: 0, min: 0 },
    markupAmount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected'],
      default: 'draft',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PartnerUser',
      default: null
    }
  },
  {
    timestamps: true,
    collection: PARTNER_QUOTES_COLLECTION
  }
);

partnerQuoteSchema.index({ partnerId: 1, createdAt: -1 });

const PartnerQuote = mongoose.models.PartnerQuote || mongoose.model('PartnerQuote', partnerQuoteSchema);

export default PartnerQuote;
