import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cookie);
  // Limite general; las rutas sensibles lo estrechan en su propia definicion.
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  registerRoutes(app);
  return app;
}
