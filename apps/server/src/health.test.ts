import { expect, it } from 'vitest';
import { buildApp } from './app.js';

// Smoke test sin base de datos: comprueba que los plugins se montan.
it('GET /api/health responde sin tocar la base de datos', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/health' });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true, engineVersion: expect.any(Number) });

  await app.close();
});
