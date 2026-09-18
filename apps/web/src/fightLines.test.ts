import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo, mulberry32, simulate } from '@rufianes/engine';
import { buildSteps } from './fightLines.js';

const replay = (seed: number) => {
  const rng = mulberry32(seed);
  const a = { ...growTo(createBrute(`vista-${seed}-a`), 12, rng), pets: ['mastin'] };
  const b = growTo(createBrute(`vista-${seed}-b`), 12, rng);
  return simulate(a, b, seed);
};

group('buildSteps', () => {
  it('convierte todo evento con texto y descarta los estructurales', () => {
    const fight = replay(7);
    const steps = buildSteps(fight);

    expect(steps.length).toBeGreaterThan(0);
    // Menos lineas que eventos: start, spawn, turn, move y hit no se pintan.
    expect(steps.length).toBeLessThan(fight.log.length);
    for (const step of steps) expect(step.text.length).toBeGreaterThan(0);
  });

  it('usa nombres, no ids, tambien para las mascotas', () => {
    const texto = buildSteps(replay(7))
      .map((s) => s.text)
      .join('\n');

    expect(texto).not.toMatch(/\bA-pet-0\b/);
    expect(texto).toMatch(/Mastin/);
  });

  it('la vida solo baja hasta 0 y nunca es negativa', () => {
    for (let seed = 0; seed < 50; seed++) {
      const fight = replay(seed);
      const steps = buildSteps(fight);
      const last = steps.at(-1);

      for (const step of steps) {
        expect(step.hpA).toBeGreaterThanOrEqual(0);
        expect(step.hpB).toBeGreaterThanOrEqual(0);
      }
      // Quien pierde acaba a 0; el log siempre termina con el evento `end`.
      const perdedorA = fight.winner === 'B';
      expect(perdedorA ? last?.hpA : last?.hpB).toBe(0);
    }
  });
});
