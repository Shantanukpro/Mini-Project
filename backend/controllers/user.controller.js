import userModel from '../models/user.model.js';
import * as userService from '../services/user.service.js';
import { validationResult } from 'express-validator';
import redisClient from '../services/redis.service.js';
import { listDevelopersForUser } from '../services/chat.service.js';

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function getToken(req) {
  const authHeader = req.headers.authorization;

  if (req.cookies?.token) return req.cookies.token;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];

  return null;
}

export const createUserController = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await userService.createUser(req.body);
    const token = user.generateJWT();

    setAuthCookie(res, token);

    res.status(201).json({ user, token });
  } catch (error) {
    const status = error.code === 11000 ? 409 : 400;
    res.status(status).json({ error: error.code === 11000 ? 'Email is already registered' : error.message });
  }
};

export const loginController = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.isValidPassword(password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = user.generateJWT();

    setAuthCookie(res, token);

    res.status(200).json({ user, token });
  } catch (error) {
    console.error('Login failed:', error.message);
    res.status(400).json({ error: error.message });
  }
};

export const profileController = async (req, res) => {
  res.status(200).json({
    user: req.user,
  });
};

export const developersController = async (req, res) => {
  try {
    const users = await listDevelopersForUser(req.user.id);

    res.status(200).json({ users });
  } catch (error) {
    console.error('Developer list failed:', error.message);
    res.status(400).json({ error: error.message });
  }
};

export const logoutController = async (req, res) => {
  try {
    const token = getToken(req);

    if (token) {
      await redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);
    }

    res.clearCookie('token');
    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout failed:', error.message);
    res.status(400).json({ error: error.message });
  }
};
