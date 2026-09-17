import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, randInt, weightedPick } from './prng.js';

const take = (seed: number, n: number): number[] => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng());
};

describe('prng', () => {
  it('misma semilla, misma secuencia', () => {
    expect(take(1234, 50)).toEqual(take(1234, 50));
  });

  it('semillas distintas, secuencias distintas', () => {
    expect(take(1234, 50)).not.toEqual(take(1235, 50));
  });

  it('devuelve valores en [0, 1)', () => {
    for (const v of take(42, 2000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt respeta los limites y los alcanza todos', () => {
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

  it('hashString es estable y distingue slugs', () => {
    expect(hashString('garbanzo')).toBe(hashString('garbanzo'));
    expect(hashString('garbanzo')).not.toBe(hashString('garbanzos'));
  });

  it('weightedPick ignora los pesos 0 y respeta la proporcion', () => {
    const rng = mulberry32(99);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) {
      counts[
        weightedPick<'a' | 'b' | 'c'>(rng, [
          { value: 'a', weight: 3 },
          { value: 'b', weight: 1 },
          { value: 'c', weight: 0 },
        ])
      ] += 1;
    }
    expect(counts.c).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
  });
});
