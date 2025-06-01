import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
  },
  totalCredit: {
    type: Number,
    default: 0,
  },
  isRedListed: {
    type: Boolean,
    default: false,
  },
  lastVisit: {
    type: Date,
  },
}, { timestamps: true });

// Create index for searching
customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;