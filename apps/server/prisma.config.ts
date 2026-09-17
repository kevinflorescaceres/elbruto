import 'node:process';
import { defineConfig } from 'prisma/config';

/** Prisma 7 saca la URL del schema: migrate la lee de aqui. */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { seed: 'tsx src/seed.ts' },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://rufianes:rufianes@localhost:5432/rufianes',
  },
});
