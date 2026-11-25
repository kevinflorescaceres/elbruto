import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo, mulberry32, simulate, type FightEvent } from '@camorra/engine';
import { buildSteps, describe } from './fightLines.js';

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
    expect(texto).toMatch(/Mastín/);
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

group('describe', () => {
  const nombres: Record<string, string> = { A: 'Rufo', B: 'Pepa', 'B-pet-0': 'Chucho' };
  const nameOf = (id: string): string => nombres[id] ?? id;
  const lanza: FightEvent = { type: 'throwWeapon', id: 'A', target: 'B', weapon: 'cascote' };
  const contra: FightEvent = { type: 'counter', id: 'B', target: 'A' };
  const ataque = (id: string, target: string): FightEvent => ({
    type: 'attack',
    id,
    target,
    weapon: 'cascote',
  });

  it('un lanzamiento se cuenta una vez, no como lanzamiento y luego ataque', () => {
    expect(describe(ataque('A', 'B'), nameOf, { previo: lanza })).toBeNull();
  });

  it('el contraataque y su golpe son una sola frase', () => {
    expect(describe(contra, nameOf)).toBeNull();
    expect(describe(ataque('B', 'A'), nameOf, { previo: contra })).toBe(
      'Pepa responde a Rufo con Cascote.',
    );
    expect(describe(ataque('B', 'A'), nameOf, { previo: contra, corto: true })).toBe(
      'Pepa responde con Cascote.',
    );
  });

  it('la forma corta no nombra al rival, que se ve en el lienzo, pero si a un bicho', () => {
    expect(describe(ataque('A', 'B'), nameOf, { corto: true })).toBe('Rufo ataca con Cascote.');
    expect(describe(lanza, nameOf, { corto: true })).toBe('Rufo lanza Cascote.');
    expect(describe(ataque('A', 'B-pet-0'), nameOf, { corto: true })).toBe(
      'Rufo ataca a Chucho con Cascote.',
    );
  });

  it('la transcripcion no repite ninguna accion', () => {
    for (let seed = 0; seed < 50; seed++) {
      const texto = buildSteps(replay(seed)).map((s) => s.text);
      for (let i = 1; i < texto.length; i++) {
        const lanzo = /^(.+) le tira (.+) a (.+)\.$/.exec(texto[i - 1] ?? '');
        if (lanzo !== null)
          expect(texto[i]).not.toBe(`${lanzo[1]} ataca a ${lanzo[3]} con ${lanzo[2]}.`);
        expect(texto[i]).not.toMatch(/responde en el acto/);
      }
    }
  });
});
