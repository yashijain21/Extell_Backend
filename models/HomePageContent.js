import mongoose from 'mongoose';

const highlightCardSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: '' }
  },
  { _id: false }
);

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    role: { type: String, default: '' },
    company: { type: String, default: '' },
    quote: { type: String, default: '' },
    avatar: { type: String, default: '' }
  },
  { _id: false }
);

const homePageContentSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, default: '' },
    heroSubtitle: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    highlightCards: { type: [highlightCardSchema], default: [] },
    testimonials: { type: [testimonialSchema], default: [] },
    partnerLogos: { type: [String], default: [] }
  },
  { timestamps: true }
);

const HomePageContent =
  mongoose.models.HomePageContent || mongoose.model('HomePageContent', homePageContentSchema);

export default HomePageContent;
