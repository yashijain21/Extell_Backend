import mongoose from 'mongoose';

const solutionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    industries: { type: [String], default: [] }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Solution = mongoose.models.Solution || mongoose.model('Solution', solutionSchema);

export default Solution;
