import { defineConfig } from '@playwright/test';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// El .env local manda salvo que la shell diga otra cosa (CI no tiene .env).
const envFile = resolve(import.meta.dirname, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = 3200;
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://camorra:camorra@localhost:5432/camorra_test';

/**
 * El end-to-end corre contra el servidor de produccion, que sirve la API y el
 * frontend construido: es lo mismo que se despliega, no una version de mentira.
 */
// Tambien para el globalSetup, que limpia la base antes de empezar.
process.env['DATABASE_URL'] = DATABASE_URL;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup.ts',
  timeout: 60_000,
  // Comparten base de datos y limite de peleas diarias: en serie.
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: 'pnpm --filter @camorra/web build && pnpm --filter @camorra/server start',
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL, PORT: String(PORT), NODE_ENV: 'production' },
  },
});
