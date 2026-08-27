import mongoose from 'mongoose';

const PARTNER_USERS_COLLECTION = process.env.PARTNER_USERS_COLLECTION || 'partner_users';

const partnerUserSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['partner_admin', 'partner_user'],
      default: 'partner_admin',
      index: true
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    collection: PARTNER_USERS_COLLECTION
  }
);

partnerUserSchema.index({ partnerId: 1, role: 1 });

const PartnerUser =
  mongoose.models.PartnerUser || mongoose.model('PartnerUser', partnerUserSchema);

export default PartnerUser;
