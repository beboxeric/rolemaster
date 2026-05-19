import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRouter from './routes/auth.js';
import intakesRouter from './routes/intakes.js';
import curatorRouter from './routes/curator.js';
import salesRouter from './routes/sales.js';
import publicRouter from './routes/public.js';
import taxonomyRouter from './routes/taxonomy.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/intakes', intakesRouter);
app.use('/api/curator', curatorRouter);
app.use('/api/sales', salesRouter);
app.use('/api/public', publicRouter);
app.use('/api/taxonomy', taxonomyRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`RoleMaster API running on http://localhost:${PORT}`);
});
