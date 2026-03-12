import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: '' },
    fileUrl: { type: String, required: true, trim: true },
    description: { type: String, default: '' }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Resource = mongoose.models.Resource || mongoose.model('Resource', resourceSchema);

export default Resource;
