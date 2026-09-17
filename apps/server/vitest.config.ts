import { defineConfig } from 'vitest/config';

/**
 * Unica config por paquete del repo: los tests de integracion necesitan apuntar
 * a una base de datos propia y no pueden correr en paralelo sobre ella.
 */
export default defineConfig({
  test: {
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://rufianes:rufianes@localhost:5432/rufianes_test',
    },
    fileParallelism: false,
  },
});
