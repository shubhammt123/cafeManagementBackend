import express from 'express';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import MenuItem from '../models/MenuItem.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect all routes
router.use(authenticate);

// Get dashboard data
router.get('/', async (req, res) => {
  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Today's sales
    const todaySalesResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaid' }
        }
      }
    ]);
    
    const todaySales = todaySalesResult.length > 0 ? todaySalesResult[0].total : 0;
    
    // Total customers
    const totalCustomers = await Customer.countDocuments();
    
    // Total menu items
    const totalMenuItems = await MenuItem.countDocuments();
    
    // Pending credits
    const pendingCreditsResult = await Customer.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$totalCredit' }
        }
      }
    ]);
    
    const pendingCredits = pendingCreditsResult.length > 0 ? pendingCreditsResult[0].total : 0;
    
    // Payment method breakdown (current month)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const paymentMethodResult = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amountPaid' }
        }
      }
    ]);
    
    const cashPayments = paymentMethodResult.find(item => item._id === 'cash')?.total || 0;
    const upiPayments = paymentMethodResult.find(item => item._id === 'upi')?.total || 0;
    
    // Popular items (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const popularItems = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo, $lt: tomorrow }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          count: { $sum: '$items.quantity' },
          total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          name: '$_id',
          count: 1,
          total: 1,
          _id: 0
        }
      }
    ]);
    
    // Recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer', 'name')
      .select('customer total paymentStatus createdAt');
    
    res.json({
      todaySales,
      totalCustomers,
      totalMenuItems,
      pendingCredits,
      cashPayments,
      upiPayments,
      popularItems,
      recentTransactions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;