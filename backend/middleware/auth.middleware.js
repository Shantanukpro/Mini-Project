import jwt from 'jsonwebtoken';
import redisClient from '../services/redis.service.js';

function getToken(req) {
  const authHeader = req.headers.authorization;

  if (req.cookies?.token) return req.cookies.token;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];

  return null;
}

export const authUser = async (req, res, next) => {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(401).send({ error: 'Unauthorized User' });
    }

    const isBlacklisted = await redisClient.get(token);

    if (isBlacklisted) {
      res.clearCookie('token');

      return res.status(401).send({ error: 'Unauthorized User' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-change-me');
    req.user = decoded;

    return next();
  } catch (error) {
    console.error('Auth failed:', error.message);
    res.status(401).send({ error: 'Unauthorized User' });
  }
};
