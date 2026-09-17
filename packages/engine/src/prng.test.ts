import { describe, expect, it } from 'vitest';
import { mulberry32, randInt } from './index.js';

const take = (seed: number, n: number) => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng());
};

describe('mulberry32', () => {
  it('es determinista: misma semilla, misma secuencia', () => {
    expect(take(1234, 50)).toEqual(take(1234, 50));
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(take(1234, 50)).not.toEqual(take(1235, 50));
  });

  it('devuelve valores en [0, 1)', () => {
    for (const v of take(42, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt respeta los limites y los alcanza', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = randInt(rng, 2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });
});
