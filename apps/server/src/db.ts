/** Cliente Prisma y traduccion entre fila de BD y tipos del motor. */
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, type Brute as BruteRow } from '@prisma/client';
import { combatStats, maxHpFor, xpForLevel, type Brute } from '@camorra/engine';
import { appearanceSchema, type BruteProfile } from '@camorra/shared';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://camorra:camorra@localhost:5432/camorra';

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Dia de juego "YYYY-MM-DD" en GAME_TIMEZONE. en-CA ya da ese formato. */
export function gameDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.GAME_TIMEZONE ?? 'Europe/Madrid',
  }).format(now);
}

export const FIGHTS_PER_DAY = 6;

/**
 * Cuando vuelven las peleas: la medianoche siguiente en GAME_TIMEZONE.
 *
 * ponytail: se calcula restando la hora local de 24 h. En el dia del cambio de
 * horario se desvia una hora. Si molesta, hace falta una libreria de zonas.
 */
export function nextReset(now: Date = new Date()): Date {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.GAME_TIMEZONE ?? 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const [h = 0, m = 0, sec = 0] = partes.split(':').map(Number);
  const faltan = 86400 - (h * 3600 + m * 60 + sec);
  return new Date(now.getTime() + faltan * 1000);
}

export const fightsLeftToday = (row: Pick<BruteRow, 'fightsToday' | 'lastFightDay'>): number =>
  row.lastFightDay === gameDay() ? Math.max(0, FIGHTS_PER_DAY - row.fightsToday) : FIGHTS_PER_DAY;

/** Fila de BD -> luchador del motor. Es lo unico que `simulate()` necesita. */
export function toEngineBrute(row: BruteRow): Brute {
  return {
    name: row.name,
    slug: row.slug,
    level: row.level,
    xp: row.xp,
    endurance: row.endurance,
    strength: row.strength,
    agility: row.agility,
    speed: row.speed,
    weapons: row.weapons,
    skills: row.skills,
    pets: row.pets,
    appearance: appearanceSchema.parse(row.appearance),
  };
}

/** Luchador del motor -> ficha publica. `row` aporta lo que el motor no sabe. */
export function toProfile(
  brute: Brute,
  extra: {
    wins: number;
    losses: number;
    isBot: boolean;
    fightsLeftToday: number;
    pendingLevelUp: boolean;
    rank?: number | null;
  },
): BruteProfile {
  return {
    name: brute.name,
    slug: brute.slug,
    level: brute.level,
    xp: brute.xp,
    xpToNextLevel: xpForLevel(brute.level),
    maxHp: combatStats(brute).maxHp,
    endurance: brute.endurance,
    strength: brute.strength,
    agility: brute.agility,
    speed: brute.speed,
    weapons: brute.weapons,
    skills: brute.skills,
    pets: brute.pets,
    appearance: brute.appearance,
    nextResetAt: nextReset().toISOString(),
    rank: extra.rank ?? null,
    ...extra,
  };
}

/** Ficha a partir de una fila, con los contadores ya resueltos. */
export function rowToProfile(
  row: BruteRow & { levelUpChoice?: unknown | null },
  /**
   * Objeto y no un numero suelto a proposito: `brutes.map(rowToProfile)` pasaba
   * el indice del array aqui y el primer peleon salia con el puesto 0.
   */
  opciones: { rank?: number } = {},
): BruteProfile {
  return toProfile(toEngineBrute(row), {
    wins: row.wins,
    losses: row.losses,
    isBot: row.isBot,
    fightsLeftToday: fightsLeftToday(row),
    pendingLevelUp: row.levelUpChoice != null,
    rank: opciones.rank ?? null,
  });
}

/** Solo para la repeticion: el snapshot no lleva record ni contadores. */
export const snapshotToProfile = (brute: Brute): BruteProfile =>
  toProfile(brute, {
    wins: 0,
    losses: 0,
    isBot: false,
    fightsLeftToday: 0,
    pendingLevelUp: false,
    rank: null,
  });

export { maxHpFor };

/** Prisma exige un tipo JSON con index signature; nuestros tipos son concretos. */
export const asJson = <T>(value: T): Prisma.InputJsonValue =>
  value as unknown as Prisma.InputJsonValue;
