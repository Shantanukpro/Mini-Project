import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'chat',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },
  role: {
    type: String,
    enum: ['user', 'ai'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000,
  },
  provider: {
    type: String,
    default: null,
  },
  clientMessageId: {
    type: String,
  },
}, {
  timestamps: true,
});

messageSchema.index(
  { chat: 1, clientMessageId: 1 },
  { unique: true, sparse: true },
);
messageSchema.index({ chat: 1, createdAt: 1 });

const Message = mongoose.model('message', messageSchema);

export default Message;
