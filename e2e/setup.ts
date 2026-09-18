import { prisma } from '../apps/server/src/db.js';

/**
 * Base limpia antes de cada pasada. Sin esto, la arena devuelve 6 rivales al
 * azar de entre todo lo acumulado y el peleon recien creado puede no salir.
 */
export default async function limpiar(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Report", "Fight", "LevelUpChoice", "Brute", "Keeper" RESTART IDENTITY CASCADE',
  );
  await prisma.$disconnect();
}
