import mongoose from 'mongoose';

const groupMemberSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['leader', 'member', 'passenger'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'removed'],
    default: 'pending'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

// Unique compound index: a user can only have one membership record per group
groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export const GroupMember = mongoose.model('GroupMember', groupMemberSchema);
