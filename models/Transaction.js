import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  items: [
    {
      item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true,
      },
      name: String,
      price: Number,
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
    },
  ],
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'credit'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'pending'],
    required: true,
  },
}, { timestamps: true });

// Virtual for remaining amount
transactionSchema.virtual('remainingAmount').get(function() {
  return this.total - this.amountPaid;
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;