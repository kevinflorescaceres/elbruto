import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';
import { registerWeb } from './web.js';

export interface AppOptions {
  /** Peticiones por minuto y por IP. */
  globalLimit?: number;
  /** Creaciones de luchador y denuncias por hora y por IP (PLAN.md §4). */
  createLimit?: number;
}

export async function buildApp({
  globalLimit = 120,
  createLimit = 5,
}: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cookie);
  await app.register(rateLimit, { max: globalLimit, timeWindow: '1 minute' });

  registerRoutes(app, { createLimit });
  // En produccion el mismo servidor sirve el frontend; en desarrollo lo hace Vite.
  await registerWeb(app);
  return app;
}
