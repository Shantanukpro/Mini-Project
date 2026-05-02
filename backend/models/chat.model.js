import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  lastMessage: {
    content: String,
    role: {
      type: String,
      enum: ['user', 'ai'],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      default: null,
    },
    provider: String,
    createdAt: Date,
  },
  // Soft-delete: user IDs who have removed this chat from their view
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
  }],
}, {
  timestamps: true,
});

chatSchema.index({ participants: 1, updatedAt: -1 });

const Chat = mongoose.model('chat', chatSchema);

export default Chat;
