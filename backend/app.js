import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import connect from './db/db.js';
import chatRoutes from './routes/chat.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

connect();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/users', userRoutes);
app.use('/chat', chatRoutes);

app.get('/', (_req, res) => {
  res.json({
    name: 'Developer Chat Platform API',
    status: 'ok',
  });
});

export default app; 
