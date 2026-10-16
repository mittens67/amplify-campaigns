import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Db } from './db/index.js';
import { principalMiddleware } from './lib/auth.js';
import { clock } from './lib/clock.js';
import { errorHandler } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { campaignRoutes } from './routes/campaigns.js';
import { reviewRoutes } from './routes/review.js';
import { localUploadDir } from './services/storage.js';

export function createApp(db: Db) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  // Lets clients show deadlines relative to the (possibly advanced) demo clock.
  app.use((_req, res, next) => {
    res.setHeader('X-Server-Now', clock.now().toISOString());
    res.setHeader('Access-Control-Expose-Headers', 'X-Server-Now');
    next();
  });

  app.get('/health', async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true, db: db.driver });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.use('/uploads', express.static(localUploadDir, { maxAge: '7d', fallthrough: false }));

  app.use(rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(['/auth/login', '/auth/signup'], rateLimit({ windowMs: 15 * 60_000, limit: 30 }));
  app.use('/ai', rateLimit({ windowMs: 60_000, limit: 20 }));
  app.use('/contributions', rateLimit({ windowMs: 60_000, limit: 60 }));

  app.use(principalMiddleware);
  app.use(authRoutes(db));
  app.use(campaignRoutes(db));
  app.use(reviewRoutes(db));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  app.use(errorHandler);
  return app;
}
