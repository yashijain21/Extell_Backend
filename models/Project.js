import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    client: { type: String, default: '' },
    industry: { type: String, default: '' },
    location: { type: String, default: '' },
    description: { type: String, default: '' },
    technologies: { type: [String], default: [] },
    images: { type: [String], default: [] },
    completionDate: { type: Date }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

export default Project;
