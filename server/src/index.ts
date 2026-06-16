import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as dotenv from 'dotenv';
import stockRoutes from './routes/stockRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import tradingRoutes from './routes/tradingRoutes';
import authRoutes from './routes/authRoutes';

// Routes
app.use('/api/stock', stockRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/auth', authRoutes);

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
