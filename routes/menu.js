import express from 'express';
import MenuItem from '../models/MenuItem.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect all routes
router.use(authenticate);

// Get all menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.find().sort({ category: 1, name: 1 });
    res.json(menuItems);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single menu item
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new menu item
router.post('/', async (req, res) => {
  try {
    const { name, price, category, isAvailable } = req.body;
    
    // Check if menu item already exists
    const existingItem = await MenuItem.findOne({ name });
    if (existingItem) {
      return res.status(400).json({ message: 'Menu item with this name already exists' });
    }
    
    const menuItem = new MenuItem({
      name,
      price,
      category,
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });
    
    await menuItem.save();
    res.status(201).json(menuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a menu item
router.put('/:id', async (req, res) => {
  try {
    const { name, price, category, isAvailable } = req.body;
    
    // Check if updating to a name that already exists
    if (name) {
      const existingItem = await MenuItem.findOne({ name, _id: { $ne: req.params.id } });
      if (existingItem) {
        return res.status(400).json({ message: 'Another menu item with this name already exists' });
      }
    }
    
    const menuItem = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { name, price, category, isAvailable },
      { new: true }
    );
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json(menuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a menu item
router.delete('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByIdAndDelete(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle menu item availability
router.patch('/:id/toggle-availability', async (req, res) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    menuItem.isAvailable = !menuItem.isAvailable;
    await menuItem.save();
    
    res.json(menuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;