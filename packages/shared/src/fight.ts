/**
 * Esquemas Zod de los eventos de combate (PLAN.md §7).
 *
 * La fuente de verdad son los tipos de `@camorra/engine`: el motor es quien
 * produce los eventos y no puede depender de zod (§12). Aqui se construye el
 * esquema encima y `assertSameShape` hace fallar `pnpm typecheck` si los dos
 * se desincronizan.
 */
import { z } from 'zod';
import type { Appearance, Brute, FightEvent, FightResult, Side } from '@camorra/engine';

const id = z.string().min(1);
const sideSchema = z.enum(['A', 'B']);

export const fightEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), seed: z.number().int() }),
  z.object({
    type: z.literal('spawn'),
    id,
    name: z.string(),
    side: sideSchema,
    isPet: z.boolean(),
    hp: z.number().int().nonnegative(),
    maxHp: z.number().int().positive(),
    weapon: z.string(),
  }),
  z.object({ type: z.literal('turn'), id }),
  z.object({ type: z.literal('move'), id, target: id }),
  z.object({ type: z.literal('attack'), id, target: id, weapon: z.string() }),
  z.object({ type: z.literal('hit'), id, target: id }),
  z.object({ type: z.literal('evade'), id }),
  z.object({ type: z.literal('block'), id }),
  z.object({ type: z.literal('counter'), id, target: id }),
  z.object({
    type: z.literal('damage'),
    id,
    amount: z.number().int().positive(),
    hp: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('heal'),
    id,
    amount: z.number().int().positive(),
    hp: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('drawWeapon'), id, weapon: z.string() }),
  z.object({ type: z.literal('throwWeapon'), id, target: id, weapon: z.string() }),
  z.object({ type: z.literal('disarm'), id, target: id, weapon: z.string() }),
  z.object({ type: z.literal('skill'), id, skill: z.string() }),
  z.object({ type: z.literal('death'), id }),
  z.object({ type: z.literal('end'), winner: sideSchema, turns: z.number().int().positive() }),
]);

export const appearanceSchema = z.object({
  body: z.number().int().nonnegative(),
  head: z.number().int().nonnegative(),
  hair: z.number().int().nonnegative(),
  skinColor: z.number().int().nonnegative(),
  hairColor: z.number().int().nonnegative(),
  clothColor: z.number().int().nonnegative(),
});

export const bruteSchema = z.object({
  name: z.string(),
  slug: z.string(),
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  endurance: z.number().int(),
  strength: z.number().int(),
  agility: z.number().int(),
  speed: z.number().int(),
  weapons: z.array(z.string()),
  skills: z.array(z.string()),
  pets: z.array(z.string()),
  appearance: appearanceSchema,
});

export const fightResultSchema = z.object({
  engineVersion: z.number().int().positive(),
  seed: z.number().int(),
  winner: sideSchema,
  turns: z.number().int().positive(),
  log: z.array(fightEventSchema),
});

/**
 * Falla en compilacion si el esquema y el tipo del motor dejan de coincidir,
 * en cualquiera de las dos direcciones.
 */
type AssertSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export type _EventsMatch = AssertSame<z.infer<typeof fightEventSchema>, FightEvent>;
export type _ResultMatch = AssertSame<z.infer<typeof fightResultSchema>, FightResult>;
export type _BruteMatch = AssertSame<z.infer<typeof bruteSchema>, Brute>;
export type _AppearanceMatch = AssertSame<z.infer<typeof appearanceSchema>, Appearance>;
export type _SideMatch = AssertSame<z.infer<typeof sideSchema>, Side>;

const _checks: [_EventsMatch, _ResultMatch, _BruteMatch, _AppearanceMatch, _SideMatch] = [
  true,
  true,
  true,
  true,
  true,
];
void _checks;
