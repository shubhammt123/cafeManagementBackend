import express from 'express';
import Transaction from '../models/Transaction.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect all routes
router.use(authenticate);

// Get report data
router.get('/', async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    
    // Default to last 6 months if no dates provided
    if (!startDate || !endDate) {
      const today = new Date();
      endDate = today.toISOString().split('T')[0];
      
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(today.getMonth() - 5);
      sixMonthsAgo.setDate(1); // Start from the first day of the month
      startDate = sixMonthsAgo.toISOString().split('T')[0];
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of the day
    
    // Monthly sales data
    const monthlySalesData = await getMonthlySales(start, end);
    
    // Category breakdown
    const categoryBreakdown = await getCategoryBreakdown(start, end);
    
    // Top selling items
    const topItems = await getTopItems(start, end);
    
    // Payment method summary
    const paymentMethodSummary = await getPaymentMethodSummary(start, end);
    
    res.json({
      monthlySales: monthlySalesData,
      categoryBreakdown,
      topItems,
      paymentMethodSummary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get monthly sales
async function getMonthlySales(startDate, endDate) {
  // Create an array of month names between start and end dates
  const months = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    months.push({
      month: currentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
      year: currentDate.getFullYear(),
      monthNum: currentDate.getMonth(),
    });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Get sales data for each month
  const result = [];
  
  for (const monthData of months) {
    const startOfMonth = new Date(monthData.year, monthData.monthNum, 1);
    const endOfMonth = new Date(monthData.year, monthData.monthNum + 1, 0, 23, 59, 59, 999);
    
    const monthlyData = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amountPaid' }
        }
      }
    ]);
    
    const cashTotal = monthlyData.find(item => item._id === 'cash')?.total || 0;
    const upiTotal = monthlyData.find(item => item._id === 'upi')?.total || 0;
    const creditTotal = monthlyData.find(item => item._id === 'credit')?.total || 0;
    
    result.push({
      month: monthData.month,
      total: cashTotal + upiTotal,
      cashTotal,
      upiTotal,
      creditTotal,
    });
  }
  
  return result;
}

// Helper function to get category breakdown
async function getCategoryBreakdown(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'menuitems',
        localField: 'items.item',
        foreignField: '_id',
        as: 'menuItemDetails'
      }
    },
    { $unwind: '$menuItemDetails' },
    {
      $group: {
        _id: '$menuItemDetails.category',
        total: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
      }
    },
    { $sort: { total: -1 } },
    {
      $project: {
        category: '$_id',
        total: 1,
        _id: 0
      }
    }
  ];
  
  return await Transaction.aggregate(pipeline);
}

// Helper function to get top selling items
async function getTopItems(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        count: { $sum: '$items.quantity' },
        total: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $project: {
        name: '$_id',
        count: 1,
        total: 1,
        _id: 0
      }
    }
  ];
  
  return await Transaction.aggregate(pipeline);
}

// Helper function to get payment method summary
async function getPaymentMethodSummary(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$amountPaid' }
      }
    },
    { $sort: { total: -1 } },
    {
      $project: {
        method: '$_id',
        total: 1,
        _id: 0
      }
    }
  ];
  
  return await Transaction.aggregate(pipeline);
}

export default router;