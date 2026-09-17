import { describe, expect, it } from 'vitest';
import { createBrute, growTo } from './brute.js';
import { mulberry32 } from './prng.js';
import { ENGINE_VERSION, simulate } from './simulate.js';
import { validateLog } from './validate.js';
import type { Brute } from './types.js';

/** Pareja de luchadores del mismo nivel, derivada de una semilla. */
function pair(seed: number, level: number): [Brute, Brute] {
  const rng = mulberry32(seed);
  return [
    growTo(createBrute(`peleon-${seed}-a`), level, rng),
    growTo(createBrute(`peleon-${seed}-b`), level, rng),
  ];
}

describe('simulate', () => {
  it('es determinista: misma entrada, mismo log', () => {
    const [a, b] = pair(1, 10);
    expect(simulate(a, b, 777)).toEqual(simulate(a, b, 777));
  });

  it('semillas distintas dan combates distintos', () => {
    const [a, b] = pair(1, 10);
    expect(simulate(a, b, 777).log).not.toEqual(simulate(a, b, 778).log);
  });

  it('declara la version del motor', () => {
    const [a, b] = pair(1, 1);
    expect(simulate(a, b, 1).engineVersion).toBe(ENGINE_VERSION);
  });

  it('todo combate termina y el log cumple las invariantes', () => {
    for (let seed = 0; seed < 2000; seed++) {
      const level = (seed % 30) + 1;
      const [a, b] = pair(seed, level);
      const result = simulate(a, b, seed * 31 + 7);

      expect(result.turns).toBeGreaterThan(0);
      expect(result.turns).toBeLessThanOrEqual(500);
      expect(result.log.length).toBeGreaterThan(2);

      const errors = validateLog(result);
      if (errors.length > 0) {
        throw new Error(`semilla ${seed} (nivel ${level}): ${errors.join('; ')}`);
      }
    }
  });

  it('las mascotas pelean pero no deciden el combate', () => {
    const rng = mulberry32(9);
    const withPet = { ...growTo(createBrute('con-mascota'), 15, rng), pets: ['mastin'] };
    const plain = growTo(createBrute('sin-mascota'), 15, rng);

    const result = simulate(withPet, plain, 12345);
    const ids = new Set(result.log.map((e) => ('id' in e ? e.id : '')));
    expect(ids.has('A-pet-0')).toBe(true);
    // El final siempre lo marca un luchador, nunca una mascota.
    expect(validateLog(result)).toEqual([]);
  });

  it('un luchador con ventaja aplastante gana casi siempre', () => {
    const weak = createBrute('flojo');
    const strong = { ...weak, slug: 'fuerte', endurance: 40, strength: 40, agility: 15, speed: 20 };
    let wins = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (simulate(strong, weak, seed).winner === 'A') wins += 1;
    }
    expect(wins).toBeGreaterThan(190);
  });
});
