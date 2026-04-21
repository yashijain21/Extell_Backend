import mongoose from 'mongoose';

const SUPPORT_TICKETS_COLLECTION = process.env.SUPPORT_TICKETS_COLLECTION || 'SupportTickets';

const supportTicketSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    mobile: { type: String, required: true, trim: true },
    subject: { type: String, default: '', trim: true },
    message: { type: String, default: '', trim: true },
    serialNumber: { type: String, default: '', trim: true },
    category: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['normal', 'high', 'critical'], default: 'normal' },
    description: { type: String, required: true, trim: true },
    attachmentNames: { type: [String], default: [] },
    attachmentUrls: { type: [String], default: [] },
    status: { type: String, default: 'open' }
  },
  {
    timestamps: true,
    collection: SUPPORT_TICKETS_COLLECTION
  }
);

const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', supportTicketSchema);

export default SupportTicket;
