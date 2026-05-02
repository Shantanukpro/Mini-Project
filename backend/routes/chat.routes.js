import { Router } from 'express';
import { body, param } from 'express-validator';
import * as authMiddleware from '../middleware/auth.middleware.js';
import {
  createChatController,
  deleteChatController,
  listChatsController,
  listMessagesController,
  sendChatMessageController,
} from '../controllers/chat.controller.js';

const router = Router();

router.use(authMiddleware.authUser);

router.get('/', listChatsController);

router.post(
  '/',
  body('participantId')
    .isMongoId()
    .withMessage('Participant must be a valid user id'),
  createChatController,
);

router.get(
  '/:chatId/messages',
  param('chatId').isMongoId().withMessage('Chat must be a valid id'),
  listMessagesController,
);

router.post(
  '/:chatId/messages',
  param('chatId').isMongoId().withMessage('Chat must be a valid id'),
  body('message')
    .isString()
    .trim()
    .escape()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message must be between 1 and 4000 characters'),
  body('clientMessageId')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Client message id is too long'),
  sendChatMessageController,
);

router.delete(
  '/:chatId',
  param('chatId').isMongoId().withMessage('Chat must be a valid id'),
  deleteChatController,
);

export default router;
