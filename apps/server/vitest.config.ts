import { defineConfig } from 'vitest/config';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// El .env local manda salvo que la shell diga otra cosa (CI no tiene .env).
const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * Unica config por paquete del repo: los tests de integracion necesitan apuntar
 * a una base de datos propia y no pueden correr en paralelo sobre ella.
 */
export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgresql://camorra:camorra@localhost:5432/camorra_test',
    },
    fileParallelism: false,
  },
});
