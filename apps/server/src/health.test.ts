import { expect, it } from 'vitest';
import { buildApp } from './app.js';

it('GET /api/health responde el DTO validado', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'GET', url: '/api/health' });

  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ ok: true, engineVersion: expect.any(Number) });

  await app.close();
});
