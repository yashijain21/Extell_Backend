import mongoose from 'mongoose';

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }
  },
  { timestamps: true, collection: 'password_reset_otps' }
);

const PasswordResetOtp = mongoose.models.PasswordResetOtp ||
  mongoose.model('PasswordResetOtp', passwordResetOtpSchema);

export default PasswordResetOtp;
