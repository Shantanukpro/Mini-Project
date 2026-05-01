import { validationResult } from 'express-validator';
import {
  createAiMessage,
  createChat,
  createUserMessage,
  extractAiPrompt,
  isAiMessage,
  listChatsForUser,
  listMessagesForChat,
} from '../services/chat.service.js';
import { generateChatReply } from '../services/ai.service.js';
import { emitChatCreated, emitMessageCreated } from '../services/socket.service.js';

function handleValidation(req, res) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }

  return true;
}

function handleControllerError(res, error, fallbackStatus = 400) {
  const status = error.statusCode || fallbackStatus;
  res.status(status).json({ error: error.message || 'Request failed' });
}

export const listChatsController = async (req, res) => {
  try {
    const chats = await listChatsForUser(req.user.id);

    res.status(200).json({ chats });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createChatController = async (req, res) => {
  if (!handleValidation(req, res)) return;

  try {
    const { chat, isNew } = await createChat({
      creatorId: req.user.id,
      participantId: req.body.participantId,
    });

    if (isNew) {
      emitChatCreated(req.app.get('io'), chat);
    }

    res.status(isNew ? 201 : 200).json({ chat, isNew });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listMessagesController = async (req, res) => {
  if (!handleValidation(req, res)) return;

  try {
    const messages = await listMessagesForChat({
      chatId: req.params.chatId,
      userId: req.user.id,
    });

    res.status(200).json({ messages });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const sendChatMessageController = async (req, res) => {
  if (!handleValidation(req, res)) return;

  try {
    const io = req.app.get('io');
    const { message, clientMessageId } = req.body;
    const { message: savedMessage, duplicate, chat } = await createUserMessage({
      chatId: req.params.chatId,
      senderId: req.user.id,
      content: message,
      clientMessageId,
    });

    const createdMessages = [savedMessage];

    if (!duplicate) {
      emitMessageCreated(io, chat, savedMessage);

      if (isAiMessage(savedMessage.content)) {
        const prompt = extractAiPrompt(savedMessage.content);
        const result = await generateChatReply(prompt || savedMessage.content);
        const aiMessage = await createAiMessage({
          chatId: req.params.chatId,
          content: result.reply,
          provider: result.provider,
        });

        createdMessages.push(aiMessage);
        emitMessageCreated(io, chat, aiMessage);
      }
    }

    res.status(201).json({ messages: createdMessages });
  } catch (error) {
    console.error('Message send failed:', error.message);
    handleControllerError(res, error, 502);
  }
};
