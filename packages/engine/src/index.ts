/**
 * Motor de combate. Determinista, puro, sin dependencias ni I/O (PLAN.md §2).
 * Si cambian las reglas, sube ENGINE_VERSION: los combates viejos se siguen
 * mostrando con su log guardado.
 */
export const ENGINE_VERSION = 1;

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

/** Entero en [min, max], ambos incluidos. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
