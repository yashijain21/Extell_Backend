import Product from '../models/Product.js';
import SupportTicket from '../models/SupportTicket.js';
import { ensureDb, USE_DB } from '../utils/db.js';

const getDistinctCategories = async () => {
  const categories = await Product.distinct('category');
  if (categories && categories.length) return categories;

  const fallback = await Product.distinct('Categories');
  return (fallback || []).filter(Boolean);
};

export const getDashboardStats = async (_req, res) => {
  try {
    await ensureDb();
    if (!USE_DB) {
      return res.json({
        totalProducts: 0,
        totalCategories: 0,
        totalTickets: 0,
        categoryStats: [],
        monthlyTickets: [],
        latestTickets: []
      });
    }

    const [totalProducts, totalTickets] = await Promise.all([
      Product.estimatedDocumentCount(),
      SupportTicket.estimatedDocumentCount()
    ]);

    const categories = await getDistinctCategories();

    const categoryStats = await Product.aggregate([
      {
        $project: {
          category: {
            $ifNull: ['$category', '$Categories']
          }
        }
      },
      { $match: { category: { $ne: null, $ne: '' } } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const monthlyTickets = await SupportTicket.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    const latestTickets = await SupportTicket.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email subject category priority status createdAt')
      .lean();

    return res.json({
      totalProducts: totalProducts || 0,
      totalCategories: categories.length,
      totalTickets: totalTickets || 0,
      categoryStats: categoryStats.map((item) => ({
        category: item._id,
        count: item.count
      })),
      monthlyTickets: monthlyTickets.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        count: item.count
      })),
      latestTickets
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
