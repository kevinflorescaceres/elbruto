/** PRNG y utilidades deterministas. Sin Math.random, sin Date (PLAN.md §2). */

export type Rng = () => number;

/** PRNG mulberry32: 32 bits de estado, devuelve [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a de 32 bits. Convierte un slug en la semilla del luchador. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Entero en [min, max], ambos incluidos. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** true con probabilidad `percent` (0-100). */
export function chance(rng: Rng, percent: number): boolean {
  return randInt(rng, 1, 100) <= percent;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[randInt(rng, 0, items.length - 1)];
  if (item === undefined) throw new Error('pick sobre una lista vacia');
  return item;
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** Elige por peso. Los pesos no necesitan sumar nada en concreto. */
export function weightedPick<T>(rng: Rng, options: readonly Weighted<T>[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  if (total <= 0) throw new Error('weightedPick sin peso total');
  let roll = randInt(rng, 1, total);
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.value;
  }
  throw new Error('weightedPick inalcanzable');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
