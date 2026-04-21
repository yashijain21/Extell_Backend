import mongoose from 'mongoose';

const QUOTE_REQUESTS_COLLECTION = process.env.QUOTE_REQUESTS_COLLECTION || 'QuoteRequests';

const quoteRequestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    companyName: { type: String, default: '', trim: true },
    requirements: { type: String, required: true, trim: true },
    productName: { type: String, default: '', trim: true },
    productSku: { type: String, default: '', trim: true },
    source: { type: String, default: 'product-detail', trim: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'closed'],
      default: 'new'
    }
  },
  {
    timestamps: true,
    collection: QUOTE_REQUESTS_COLLECTION
  }
);

const QuoteRequest = mongoose.models.QuoteRequest || mongoose.model('QuoteRequest', quoteRequestSchema);

export default QuoteRequest;
