import { defineConfig } from 'prisma/config';

// Node 22 lee el .env solo cuando se lo pides por bandera, y la CLI de Prisma no
// pasa por nuestros scripts.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// El .env local manda salvo que la shell diga otra cosa (CI no tiene .env).
const envFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

/** Prisma 7 saca la URL del schema: migrate la lee de aqui. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'tsx src/seed.ts' },
  datasource: {
    // Las migraciones necesitan conexion directa: a traves de un pooler en modo
    // transaccion (el de Supabase, por ejemplo) fallan.
    // PRISMA_TARGET=test apunta a la base de pruebas. La eleccion se resuelve
    // aqui y no en el script porque sh no lee el .env y Node si.
    url:
      process.env.PRISMA_TARGET === 'test'
        ? (process.env.TEST_DATABASE_URL ??
          'postgresql://camorra:camorra@localhost:5432/camorra_test')
        : (process.env.DIRECT_URL ??
          process.env.DATABASE_URL ??
          'postgresql://camorra:camorra@localhost:5432/camorra'),
  },
});
