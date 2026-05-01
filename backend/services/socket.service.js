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
  const result = await generateChatReply(aiInput);
  const aiMessage = await createAiMessage({
    chatId,
    content: result.reply,
    provider: result.provider,
  });

  emitMessageCreated(io, chat, aiMessage);
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
    socket.join(userRoom(socket.user.id));

    socket.on('chat:join', async ({ chatId }, ack) => {
      try {
        await getChatForUser(chatId, socket.user.id);
        socket.join(chatRoom(chatId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });

    socket.on('chat:leave', ({ chatId }) => {
      if (chatId) socket.leave(chatRoom(chatId));
    });

    socket.on('message:send', async ({ chatId, content, clientMessageId }, ack) => {
      try {
        const { message, duplicate, chat } = await createUserMessage({
          chatId,
          senderId: socket.user.id,
          content,
          clientMessageId,
        });

        socket.join(chatRoom(chatId));

        if (!duplicate) {
          emitMessageCreated(io, chat, message);

          await broadcastAiReply(io, chat, chatId, message.content);
        }

        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
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
