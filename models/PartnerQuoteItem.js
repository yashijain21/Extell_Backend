import mongoose from 'mongoose';

const PARTNER_QUOTE_ITEMS_COLLECTION = process.env.PARTNER_QUOTE_ITEMS_COLLECTION || 'partner_quote_items';

const partnerQuoteItemSchema = new mongoose.Schema(
  {
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PartnerQuote',
      required: true,
      index: true
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, default: '', trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  {
    timestamps: true,
    collection: PARTNER_QUOTE_ITEMS_COLLECTION
  }
);

partnerQuoteItemSchema.index({ quoteId: 1, productId: 1 });

const PartnerQuoteItem =
  mongoose.models.PartnerQuoteItem || mongoose.model('PartnerQuoteItem', partnerQuoteItemSchema);

export default PartnerQuoteItem;
