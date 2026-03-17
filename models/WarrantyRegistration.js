import mongoose from 'mongoose';

const WARRANTY_COLLECTION = process.env.WARRANTY_COLLECTION || 'WarrantyRegistrations';

const warrantyRegistrationSchema = new mongoose.Schema(
  {
    customerName: { type: String, trim: true, default: '' },
    productName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    invoiceId: { type: String, required: true, trim: true },
    serialNumber: { type: String, trim: true, default: '' },
    purchaseDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  {
    timestamps: true,
    collection: WARRANTY_COLLECTION
  }
);

warrantyRegistrationSchema.index({ productName: 'text', invoiceId: 'text', customerName: 'text' });
warrantyRegistrationSchema.index({ status: 1, createdAt: -1 });

const WarrantyRegistration =
  mongoose.models.WarrantyRegistration || mongoose.model('WarrantyRegistration', warrantyRegistrationSchema);

export default WarrantyRegistration;
