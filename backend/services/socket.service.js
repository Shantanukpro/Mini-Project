import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import userModel from '../models/user.model.js';
import {
  createAiMessage,
  createUserMessage,
  extractAiPrompt,
  getChatForUser,
  isAiMessage,
} from './chat.service.js';
import { generateChatReply } from './ai.service.js';

const userRoom = (userId) => `user:${userId}`;
const chatRoom = (chatId) => `chat:${chatId}`;

// Track active socket connections per user { userId: count }
const userConnections = new Map();

function readToken(socket) {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers.authorization;

  if (authToken) return authToken;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];

  return null;
}

async function authenticateSocket(socket, next) {
  try {
    const token = readToken(socket);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
    const user = await userModel.findById(decoded.id).select('email');

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = {
      id: user._id.toString(),
      email: user.email,
    };

    return next();
  } catch (error) {
    return next(new Error(error.message || 'Authentication failed'));
  }
}

export function emitMessageCreated(io, chat, message) {
  const chatId = chat._id?.toString() || chat.toString();
  const update = {
    chatId,
    lastMessage: {
      content: message.content,
      role: message.role,
      sender: message.sender,
      provider: message.provider,
      createdAt: message.createdAt,
    },
    updatedAt: message.updatedAt,
  };

  io?.to(chatRoom(chatId)).emit('message:new', message);
  io?.to(chatRoom(chatId)).emit('chat:updated', update);

  chat.participants?.forEach((participant) => {
    const participantId = participant._id?.toString() || participant.toString();
    io?.to(userRoom(participantId)).emit('chat:updated', update);
  });
}

async function broadcastAiReply(io, chat, chatId, userContent) {
  if (!isAiMessage(userContent)) return;

  const prompt = extractAiPrompt(userContent);
  const aiInput = prompt || userContent;

  let result;
  try {
    result = await generateChatReply(aiInput);
  } catch (err) {
    console.error('[broadcastAiReply] AI call failed, sending fallback:', err.message);
    result = {
      reply: `AI service error: ${err.message}. Please check your GEMINI_API_KEY.`,
      provider: 'local-fallback',
    };
  }

  try {
    const aiMessage = await createAiMessage({
      chatId,
      content: result.reply,
      provider: result.provider,
    });

    emitMessageCreated(io, chat, aiMessage);
  } catch (err) {
    console.error('[broadcastAiReply] Failed to save/emit AI message:', err.message);
  }
}

export function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(userRoom(userId));

    // Track presence on connect
    const currentCount = userConnections.get(userId) || 0;
    userConnections.set(userId, currentCount + 1);
    if (currentCount === 0) {
      io.emit('presence:update', { userId, isOnline: true });
    }

    socket.on('presence:request_sync', (ack) => {
      ack?.(Array.from(userConnections.keys()));
    });

    socket.on('chat:join', async ({ chatId }, ack) => {
      try {
        await getChatForUser(chatId, userId);
        socket.join(chatRoom(chatId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('chat:leave', ({ chatId }) => {
      if (chatId) socket.leave(chatRoom(chatId));
    });

    socket.on('typing:start', ({ chatId }) => {
      if (chatId) socket.broadcast.to(chatRoom(chatId)).emit('typing:start', { chatId, userId });
    });

    socket.on('typing:stop', ({ chatId }) => {
      if (chatId) socket.broadcast.to(chatRoom(chatId)).emit('typing:stop', { chatId, userId });
    });

    socket.on('message:send', async ({ chatId, content, clientMessageId }, ack) => {
      try {
        const { message, duplicate, chat } = await createUserMessage({
          chatId,
          senderId: userId,
          content,
          clientMessageId,
        });

        socket.join(chatRoom(chatId));

        if (!duplicate) {
          emitMessageCreated(io, chat, message);

          // Fire-and-forget: AI reply has its own error handling
          broadcastAiReply(io, chat, chatId, message.content);
        }

        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', async () => {
      const count = userConnections.get(userId) || 1;
      if (count <= 1) {
        userConnections.delete(userId);
        const lastSeen = new Date();
        io.emit('presence:update', { userId, isOnline: false, lastSeen });
        
        try {
          await userModel.findByIdAndUpdate(userId, { lastSeen }).exec();
        } catch (err) {
          console.error('[Socket Disconnect] Failed to update lastSeen:', err.message);
        }
      } else {
        userConnections.set(userId, count - 1);
      }
    });
  });

  return io;
}

export function emitChatCreated(io, chat) {
  chat.participants.forEach((participant) => {
    const participantId = participant._id?.toString() || participant.toString();
    io.to(userRoom(participantId)).emit('chat:created', chat);
  });
}

// Notify clients when a chat is deleted
export function emitChatDeleted(io, chatId, deletedBy, hardDeleted, participants) {
  // Always tell the deleting user to remove the chat
  io.to(userRoom(deletedBy)).emit('chat:deleted', { chatId, deletedBy });

  // If hard-deleted, also tell the other participant(s)
  if (hardDeleted && participants) {
    participants.forEach((pid) => {
      const participantId = pid._id?.toString() || pid.toString();
      if (participantId !== deletedBy) {
        io.to(userRoom(participantId)).emit('chat:deleted', { chatId, deletedBy });
      }
    });
  }
}
