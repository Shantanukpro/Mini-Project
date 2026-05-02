import { Router } from 'express';
import { body } from 'express-validator';
import * as authMiddleware from '../middleware/auth.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

const authValidation = [
  body('email').isEmail().withMessage('Email must be a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be between 2 and 60 characters long'),
  ...authValidation,
], userController.createUserController);
router.post('/login', authValidation, userController.loginController);
router.get('/profile', authMiddleware.authUser, userController.profileController);
router.get('/developers', authMiddleware.authUser, userController.developersController);
router.post('/logout', authMiddleware.authUser, userController.logoutController);

export default router;
