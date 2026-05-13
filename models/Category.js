import mongoose from 'mongoose';

const levelNodeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    children: [{ type: mongoose.Schema.Types.Mixed }]
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, trim: true, unique: true },
    subcategories: [levelNodeSchema]
  },
  {
    collection: 'categories',
    timestamps: true
  }
);

categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ slug: 1 }, { unique: true });

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

export default Category;
