import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import Fastify from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { registerWeb } from './web.js';

// Un build de mentira: lo justo para ver como sirve los ficheros estaticos.
const dist = mkdtempSync(join(tmpdir(), 'camorra-dist-'));
const js = 'console.log("camorra");'.repeat(100);
const app = Fastify();

beforeAll(async () => {
  mkdirSync(join(dist, 'assets'));
  writeFileSync(join(dist, 'index.html'), '<html><head><title>x</title></head></html>');
  writeFileSync(join(dist, 'assets', 'index-abc123.js'), js);
  writeFileSync(join(dist, 'assets', 'index-abc123.js.br'), brotliCompressSync(js));
  writeFileSync(join(dist, 'assets', 'index-abc123.js.gz'), gzipSync(js));
  writeFileSync(join(dist, 'og.png'), 'png');
  expect(await registerWeb(app, dist)).toBe(true);
});

afterAll(async () => {
  await app.close();
  rmSync(dist, { recursive: true, force: true });
});

it('sirve la version comprimida que el navegador acepta', async () => {
  const br = await app.inject({
    url: '/assets/index-abc123.js',
    headers: { 'accept-encoding': 'gzip, deflate, br' },
  });
  expect(br.statusCode).toBe(200);
  expect(br.headers['content-encoding']).toBe('br');
  expect(br.headers['vary']).toContain('accept-encoding');

  const gz = await app.inject({
    url: '/assets/index-abc123.js',
    headers: { 'accept-encoding': 'gzip' },
  });
  expect(gz.headers['content-encoding']).toBe('gzip');

  const crudo = await app.inject({ url: '/assets/index-abc123.js' });
  expect(crudo.headers['content-encoding']).toBeUndefined();
  expect(crudo.body).toBe(js);
});

it('lo que lleva hash no se vuelve a pedir; lo demas, si', async () => {
  const asset = await app.inject({ url: '/assets/index-abc123.js' });
  expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

  const og = await app.inject({ url: '/og.png' });
  expect(og.statusCode).toBe(200);
  expect(og.headers['cache-control']).not.toContain('immutable');
});
