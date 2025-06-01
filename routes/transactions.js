import express from 'express';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import MenuItem from '../models/MenuItem.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect all routes
router.use(authenticate);

// Get all transactions with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter
    const filter = {};
    
    if (req.query.search) {
      // We need to find customer ids that match the search term
      const customers = await Customer.find({
        $text: { $search: req.query.search }
      }).select('_id');
      
      filter.customer = { $in: customers.map(c => c._id) };
    }
    
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      filter.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      filter.createdAt = { $lte: new Date(req.query.endDate) };
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    
    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }
    
    // Count total documents
    const total = await Transaction.countDocuments(filter);
    
    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('customer', 'name');
    
    // Calculate total pages
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      transactions,
      page,
      totalPages,
      totalTransactions: total,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single transaction
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customer', 'name')
      .populate('items.item', 'name price');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new transaction
router.post('/', async (req, res) => {
  try {
    const { customerId, items, amountPaid, paymentMethod } = req.body;
    
    // Validate customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(400).json({ message: 'Customer not found' });
    }
    
    // Validate items
    if (!items || !items.length) {
      return res.status(400).json({ message: 'Items are required' });
    }
    
    // Process items and calculate total
    const processedItems = [];
    let total = 0;
    
    for (const item of items) {
      const menuItem = await MenuItem.findById(item.itemId);
      if (!menuItem) {
        return res.status(400).json({ message: `Menu item with ID ${item.itemId} not found` });
      }
      
      if (!menuItem.isAvailable) {
        return res.status(400).json({ message: `Menu item ${menuItem.name} is not available` });
      }
      
      const quantity = parseInt(item.quantity) || 1;
      const itemTotal = menuItem.price * quantity;
      
      processedItems.push({
        item: menuItem._id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
      });
      
      total += itemTotal;
    }
    
    // Determine payment status
    let paymentStatus;
    const actualAmountPaid = parseFloat(amountPaid) || 0;
    
    if (actualAmountPaid >= total) {
      paymentStatus = 'paid';
    } else if (actualAmountPaid > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'pending';
    }
    
    // Create transaction
    const transaction = new Transaction({
      customer: customer._id,
      items: processedItems,
      total,
      amountPaid: actualAmountPaid,
      paymentMethod: paymentMethod || (actualAmountPaid > 0 ? 'cash' : 'credit'),
      paymentStatus,
    });
    
    await transaction.save();
    
    // Update customer data
    customer.lastVisit = new Date();
    
    if (actualAmountPaid < total) {
      customer.totalCredit += (total - actualAmountPaid);
    }
    
    await customer.save();
    
    res.status(201).json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction payment
router.patch('/:id/payment', async (req, res) => {
  try {
    const { amountPaid, paymentMethod } = req.body;
    
    if (!amountPaid || amountPaid <= 0) {
      return res.status(400).json({ message: 'Valid payment amount required' });
    }
    
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    const customer = await Customer.findById(transaction.customer);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Calculate how much is still unpaid
    const unpaidAmount = transaction.total - transaction.amountPaid;
    
    if (unpaidAmount <= 0) {
      return res.status(400).json({ message: 'Transaction is already fully paid' });
    }
    
    // Calculate the actual payment (can't be more than what's owed)
    const actualPayment = Math.min(amountPaid, unpaidAmount);
    
    // Update transaction
    transaction.amountPaid += actualPayment;
    
    // Update payment status
    if (transaction.amountPaid >= transaction.total) {
      transaction.paymentStatus = 'paid';
    } else {
      transaction.paymentStatus = 'partial';
    }
    
    // If payment method provided, update it
    if (paymentMethod) {
      transaction.paymentMethod = paymentMethod;
    }
    
    await transaction.save();
    
    // Update customer credit
    customer.totalCredit -= actualPayment;
    await customer.save();
    
    res.json({
      message: 'Payment recorded successfully',
      transaction,
      paymentAmount: actualPayment,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;