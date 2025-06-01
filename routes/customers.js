import express from 'express';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect all routes
router.use(authenticate);

// Get all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    // Check if customer already exists with this phone
    const existingCustomer = await Customer.findOne({ phone });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this phone already exists' });
    }
    
    const customer = new Customer({
      name,
      phone,
      email,
    });
    
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a customer
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, isRedListed } = req.body;
    
    // Check if updating to a phone that already exists on another customer
    if (phone) {
      const existingCustomer = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
      if (existingCustomer) {
        return res.status(400).json({ message: 'Another customer with this phone already exists' });
      }
    }
    
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, email, isRedListed },
      { new: true }
    );
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a customer
router.delete('/:id', async (req, res) => {
  try {
    // Check if customer has transactions
    const transactions = await Transaction.countDocuments({ customer: req.params.id });
    if (transactions > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with existing transactions' });
    }
    
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle customer red list status
router.patch('/:id/toggle-redlist', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    customer.isRedListed = !customer.isRedListed;
    await customer.save();
    
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Record a payment from a customer
router.post('/:id/payment', async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid payment amount required' });
    }
    
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    if (customer.totalCredit <= 0) {
      return res.status(400).json({ message: 'Customer has no outstanding credit' });
    }
    
    // Ensure payment amount doesn't exceed total credit
    const paymentAmount = Math.min(amount, customer.totalCredit);
    
    // Update customer's total credit
    customer.totalCredit -= paymentAmount;
    await customer.save();
    
    // Create a new transaction to record the payment
    const transaction = new Transaction({
      customer: customer._id,
      items: [], // No items for a payment transaction
      total: paymentAmount,
      amountPaid: paymentAmount,
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: 'paid',
    });
    
    await transaction.save();
    
    res.json({
      message: 'Payment recorded successfully',
      customer,
      paymentAmount,
      remainingCredit: customer.totalCredit,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer transactions
router.get('/:id/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ customer: req.params.id })
      .sort({ createdAt: -1 })
      .populate('customer', 'name');
    
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;