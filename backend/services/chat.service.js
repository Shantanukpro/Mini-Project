import mongoose from 'mongoose';
import Chat from '../models/chat.model.js';
import Message from '../models/message.model.js';
import userModel from '../models/user.model.js';

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeId(id) {
  return id?.toString();
}

function assertValidObjectId(id, label) {
  if (!isValidObjectId(id)) {
    const error = new Error(`${label} is invalid`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeContent(content) {
  const normalized = String(content || '').trim();

  if (!normalized) {
    const error = new Error('Message content is required');
    error.statusCode = 400;
    throw error;
  }

  if (normalized.length > 4000) {
    const error = new Error('Message must not exceed 4000 characters');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}

export function isAiMessage(content) {
  const text = String(content || '').trim();
  return /^@ai\b/i.test(text) || text.startsWith('/summarize') || text.startsWith('/fix');
}

export function parseAiCommand(content) {
  const text = String(content || '').trim();
  
  if (text.startsWith('/summarize')) {
    return { command: 'summarize', payload: text.replace(/^\/summarize\b[:\s-]*/i, '').trim() };
  }
  
  if (text.startsWith('/fix')) {
    return { command: 'fix', payload: text.replace(/^\/fix\b[:\s-]*/i, '').trim() };
  }
  
  if (/^@ai\b/i.test(text)) {
    const payload = text.replace(/^@ai\b[:\s-]*/i, '').trim();
    // Support `@ai explain <code>` mapping to explain, or general prompt otherwise
    if (payload.toLowerCase().startsWith('explain ')) {
      return { command: 'explain', payload: payload.replace(/^explain\b[:\s-]*/i, '').trim() };
    }
    return { command: 'general', payload };
  }
  
  return { command: 'general', payload: text };
}

export async function listDevelopersForUser(userId) {
  return userModel
    .find({ _id: { $ne: userId } })
    .select('name email createdAt')
    .sort({ email: 1 });
}

export async function listChatsForUser(userId) {
  return Chat.find({ participants: userId })
    .populate('participants', 'name email')
    .populate('lastMessage.sender', 'name email')
    .sort({ updatedAt: -1 });
}

export async function createChat({ creatorId, participantId }) {
  assertValidObjectId(participantId, 'Participant');

  if (normalizeId(creatorId) === normalizeId(participantId)) {
    const error = new Error('Choose another developer to start a chat');
    error.statusCode = 400;
    throw error;
  }

  const participant = await userModel.findById(participantId);
  if (!participant) {
    const error = new Error('Selected developer was not found');
    error.statusCode = 404;
    throw error;
  }

  const existingChat = await Chat.findOne({
    participants: {
      $all: [creatorId, participantId],
      $size: 2,
    },
  })
    .populate('participants', 'name email')
    .populate('lastMessage.sender', 'name email');

  if (existingChat) {
    return { chat: existingChat, isNew: false };
  }

  const chat = await Chat.create({
    participants: [creatorId, participantId],
    createdBy: creatorId,
  });

  await chat.populate('participants', 'name email');

  return { chat, isNew: true };
}

export async function getChatForUser(chatId, userId) {
  assertValidObjectId(chatId, 'Chat');

  const chat = await Chat.findOne({
    _id: chatId,
    participants: userId,
  })
    .populate('participants', 'name email')
    .populate('lastMessage.sender', 'name email');

  if (!chat) {
    const error = new Error('Chat was not found for this user');
    error.statusCode = 404;
    throw error;
  }

  return chat;
}

// Hard-delete a chat and its messages for all participants
export async function deleteChatForUser(chatId, userId) {
  assertValidObjectId(chatId, 'Chat');

  const chat = await Chat.findOne({ _id: chatId, participants: userId });

  if (!chat) {
    const error = new Error('Chat was not found for this user');
    error.statusCode = 404;
    throw error;
  }

  await Message.deleteMany({ chat: chatId });
  await Chat.findByIdAndDelete(chatId);
  return { hardDeleted: true, participants: chat.participants };
}

export async function listMessagesForChat({ chatId, userId }) {
  await getChatForUser(chatId, userId);

  return Message.find({ chat: chatId })
    .populate('sender', 'name email')
    .sort({ createdAt: 1 });
}

export async function getRecentChatMessages(chatId, limit = 20) {
  assertValidObjectId(chatId, 'Chat');
  return Message.find({ chat: chatId })
    .populate('sender', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit)
    .then(messages => messages.reverse());
}

async function updateLastMessage(message) {
  await Chat.findByIdAndUpdate(message.chat, {
    lastMessage: {
      content: message.content,
      role: message.role,
      sender: message.sender,
      provider: message.provider,
      createdAt: message.createdAt,
    },
  });
}

export async function createUserMessage({
  chatId,
  senderId,
  content,
  clientMessageId = null,
}) {
  const chat = await getChatForUser(chatId, senderId);

  const normalizedContent = normalizeContent(content);

  if (clientMessageId) {
    const existingMessage = await Message.findOne({ chat: chatId, clientMessageId })
      .populate('sender', 'name email');

    if (existingMessage) {
      return { message: existingMessage, duplicate: true, chat };
    }
  }

  const message = await Message.create({
    chat: chatId,
    sender: senderId,
    role: 'user',
    content: normalizedContent,
    clientMessageId,
  });

  await updateLastMessage(message);
  await message.populate('sender', 'name email');

  return { message, duplicate: false, chat };
}

export async function createAiMessage({
  chatId,
  content,
  provider,
}) {
  const normalizedContent = normalizeContent(content);

  const message = await Message.create({
    chat: chatId,
    role: 'ai',
    content: normalizedContent,
    provider,
  });

  await updateLastMessage(message);

  return message;
}
