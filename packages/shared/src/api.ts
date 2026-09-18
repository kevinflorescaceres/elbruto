/** DTOs de la API (PLAN.md §8). Se validan en los dos lados de la red. */
import { z } from 'zod';
import type { LevelUpOption } from '@camorra/engine';
import { appearanceSchema, fightEventSchema } from './fight.js';

/**
 * Limites del nombre, en un unico sitio: los usan el esquema, la validacion del
 * servidor y el formulario de la web. Cambiarlos aqui los cambia en los tres.
 */
export const NAME_MIN = 5;
export const NAME_MAX = 20;

/** Letras, numeros, espacio, guion y guion bajo. */
export const NAME_PATTERN = new RegExp(`^[\\p{L}\\p{N} _-]{${NAME_MIN},${NAME_MAX}}$`, 'u');

export const NAME_HINT = `El nombre debe tener de ${NAME_MIN} a ${NAME_MAX} letras, numeros, guiones o espacios`;

export const nameSchema = z
  .string()
  .trim()
  .refine((v) => NAME_PATTERN.test(v), NAME_HINT);

export const statsSchema = z.object({
  endurance: z.number().int(),
  strength: z.number().int(),
  agility: z.number().int(),
  speed: z.number().int(),
});

/** Ficha publica de un luchador. */
export const bruteProfileSchema = statsSchema.extend({
  name: z.string(),
  slug: z.string(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  xpToNextLevel: z.number().int().positive(),
  maxHp: z.number().int().positive(),
  weapons: z.array(z.string()),
  skills: z.array(z.string()),
  pets: z.array(z.string()),
  appearance: appearanceSchema,
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  isBot: z.boolean(),
  fightsLeftToday: z.number().int().nonnegative(),
  pendingLevelUp: z.boolean(),
  /** Cuando vuelven las peleas. ISO, para que el cliente cuente hacia atras. */
  nextResetAt: z.string(),
  /** Puesto en el ranking. Nulo si no se ha calculado para esta respuesta. */
  rank: z.number().int().positive().nullable(),
});

export const levelUpOptionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('weapon'), id: z.string() }),
  z.object({ type: z.literal('skill'), id: z.string() }),
  z.object({ type: z.literal('pet'), id: z.string() }),
  z.object({
    type: z.literal('stat'),
    gains: z.partialRecord(z.enum(['endurance', 'strength', 'agility', 'speed']), z.number().int()),
  }),
]);

type AssertSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _optionsMatch: AssertSame<z.infer<typeof levelUpOptionSchema>, LevelUpOption> = true;
void _optionsMatch;

// --- GET /api/me ---
export const meSchema = z.object({ brutes: z.array(bruteProfileSchema) });

// --- POST /api/brutes ---
export const createBruteBody = z.object({ name: nameSchema });
export const createBruteResponse = z.object({
  brute: bruteProfileSchema,
  /** Se muestra una sola vez: no se puede volver a consultar. */
  claimUrl: z.string(),
});

// --- POST /api/claim ---
export const claimBody = z.object({ token: z.string().min(1) });
export const claimResponse = z.object({ brute: bruteProfileSchema });

// --- GET /api/brutes/:slug/fights ---
export const fightSummarySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  opponent: z.object({ name: z.string(), slug: z.string(), level: z.number().int() }),
  won: z.boolean(),
});
export const fightListSchema = z.object({
  fights: z.array(fightSummarySchema),
  nextCursor: z.string().nullable(),
});

// --- GET /api/brutes/:slug/opponents ---
export const opponentsSchema = z.object({ opponents: z.array(bruteProfileSchema) });

// --- POST /api/brutes/:slug/fights ---
export const startFightBody = z.object({ opponentSlug: z.string().min(1) });
export const startFightResponse = z.object({
  fightId: z.string(),
  won: z.boolean(),
  xpGained: z.number().int().nonnegative(),
  leveledUp: z.boolean(),
});

// --- GET|POST /api/brutes/:slug/level-up ---
export const levelUpSchema = z.object({
  level: z.number().int().positive(),
  options: z.tuple([levelUpOptionSchema, levelUpOptionSchema]),
});
export const levelUpBody = z.object({ choiceIndex: z.union([z.literal(0), z.literal(1)]) });
export const levelUpResponse = z.object({ brute: bruteProfileSchema });

// --- GET /api/fights/:id ---
export const fightReplaySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  seed: z.number().int(),
  engineVersion: z.number().int(),
  winner: z.enum(['A', 'B']),
  snapshotA: bruteProfileSchema,
  snapshotB: bruteProfileSchema,
  log: z.array(fightEventSchema),
});

// --- GET /api/ranking ---
export const rankingSchema = z.object({
  brutes: z.array(
    z.object({
      rank: z.number().int().positive(),
      name: z.string(),
      slug: z.string(),
      level: z.number().int().positive(),
      wins: z.number().int().nonnegative(),
      losses: z.number().int().nonnegative(),
    }),
  ),
  total: z.number().int().nonnegative(),
});

// --- POST /api/reports (PLAN.md §11) ---
export const reportBody = z.object({
  slug: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

export type BruteProfile = z.infer<typeof bruteProfileSchema>;
export type FightReplay = z.infer<typeof fightReplaySchema>;
export type Me = z.infer<typeof meSchema>;
