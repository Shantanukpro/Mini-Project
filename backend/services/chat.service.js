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
  return /^@ai\b/i.test(String(content || '').trim());
}

export function extractAiPrompt(content) {
  return String(content || '').trim().replace(/^@ai\b[:\s-]*/i, '').trim();
}

export async function listDevelopersForUser(userId) {
  return userModel
    .find({ _id: { $ne: userId } })
    .select('name email createdAt')
    .sort({ email: 1 });
}

export async function listChatsForUser(userId) {
  return Chat.find({ participants: userId, deletedFor: { $ne: userId } })
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
    // Restore chat if the creator had previously deleted it
    if (existingChat.deletedFor?.some((id) => normalizeId(id) === normalizeId(creatorId))) {
      existingChat.deletedFor.pull(creatorId);
      await existingChat.save();
    }
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
    deletedFor: { $ne: userId },
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

// Soft-delete a chat for one user; hard-delete when both participants removed it
export async function deleteChatForUser(chatId, userId) {
  assertValidObjectId(chatId, 'Chat');

  const chat = await Chat.findOne({ _id: chatId, participants: userId });

  if (!chat) {
    const error = new Error('Chat was not found for this user');
    error.statusCode = 404;
    throw error;
  }

  // Prevent duplicate entries
  if (!chat.deletedFor.some((id) => normalizeId(id) === normalizeId(userId))) {
    chat.deletedFor.push(userId);
    await chat.save();
  }

  // If all participants deleted → hard-delete chat + messages
  const allDeleted = chat.participants.every(
    (pid) => chat.deletedFor.some((did) => normalizeId(did) === normalizeId(pid)),
  );

  if (allDeleted) {
    await Message.deleteMany({ chat: chatId });
    await Chat.findByIdAndDelete(chatId);
    return { hardDeleted: true, participants: chat.participants };
  }

  return { hardDeleted: false, participants: chat.participants };
}

export async function listMessagesForChat({ chatId, userId }) {
  await getChatForUser(chatId, userId);

  return Message.find({ chat: chatId })
    .populate('sender', 'name email')
    .sort({ createdAt: 1 });
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
