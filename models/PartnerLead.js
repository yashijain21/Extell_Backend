import mongoose from 'mongoose';

const PARTNER_LEADS_COLLECTION = process.env.PARTNER_LEADS_COLLECTION || 'partner_leads';

const partnerLeadSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '', trim: true, lowercase: true },
    customerPhone: { type: String, default: '', trim: true },
    companyName: { type: String, default: '', trim: true },
    source: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['new', 'contacted', 'quoted', 'won', 'lost'],
      default: 'new',
      index: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PartnerUser',
      default: null
    }
  },
  {
    timestamps: true,
    collection: PARTNER_LEADS_COLLECTION
  }
);

partnerLeadSchema.index({ partnerId: 1, createdAt: -1 });

const PartnerLead = mongoose.models.PartnerLead || mongoose.model('PartnerLead', partnerLeadSchema);

export default PartnerLead;
