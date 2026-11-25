import mongoose from 'mongoose';

const rideSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  }
});

export const Ride = mongoose.model('Ride', rideSchema);
