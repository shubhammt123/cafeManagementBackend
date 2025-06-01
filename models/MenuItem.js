import mongoose from 'mongoose';

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Create index for searching
menuItemSchema.index({ name: 'text', category: 'text' });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);

export default MenuItem;