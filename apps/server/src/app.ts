import Fastify, { type FastifyInstance } from 'fastify';
import { ENGINE_VERSION } from '@rufianes/engine';
import { healthSchema } from '@rufianes/shared';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/api/health', () => healthSchema.parse({ ok: true, engineVersion: ENGINE_VERSION }));

  return app;
}
