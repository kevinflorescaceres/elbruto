import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo, mulberry32, simulate, type FightEvent } from '@rufianes/engine';
import { planFight, type Move } from './fightScene.js';

/** Combates variados: con mascotas, de todos los niveles. */
function fight(seed: number) {
  const rng = mulberry32(seed);
  const level = (seed % 30) + 1;
  const a = growTo(createBrute(`escena-${seed}-a`), level, rng);
  const b = growTo(createBrute(`escena-${seed}-b`), level, rng);
  const conBichos = seed % 3 === 0;
  return simulate(conBichos ? { ...a, pets: ['chucho', 'mastin'] } : a, b, seed * 17 + 3);
}

/** Todo id de combatiente al que apunta un movimiento. */
function referenced(move: Move): string[] {
  if (move.kind === 'projectile') return [move.from, move.to];
  if (move.kind === 'approach' || move.kind === 'lunge') return [move.id, move.toward];
  return [move.id];
}

group('planFight', () => {
  it('reproduce cualquier combate de principio a fin sin incoherencias', () => {
    for (let seed = 0; seed < 600; seed++) {
      const scene = planFight(fight(seed));
      const ids = new Set(scene.actors.map((a) => a.id));

      expect(scene.actors.length).toBeGreaterThanOrEqual(2);
      expect(scene.duration).toBeGreaterThan(0);
      expect(Number.isFinite(scene.duration)).toBe(true);

      let previous = -1;
      for (const beat of scene.beats) {
        // Los tiempos avanzan y nunca retroceden.
        expect(beat.at).toBeGreaterThanOrEqual(previous);
        previous = beat.at;
        expect(Number.isFinite(beat.at)).toBe(true);
        expect(beat.duration).toBeGreaterThanOrEqual(0);

        for (const move of beat.moves) {
          for (const id of referenced(move)) {
            if (!ids.has(id)) throw new Error(`semilla ${seed}: ${move.kind} apunta a ${id}`);
          }
        }
      }

      const last = scene.beats.at(-1);
      expect(scene.duration).toBeCloseTo((last?.at ?? 0) + (last?.duration ?? 0), 6);
    }
  }, 30_000);

  it('todas las posiciones caen dentro del lienzo', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const actor of planFight(fight(seed)).actors) {
        expect(actor.home.x).toBeGreaterThan(0);
        expect(actor.home.x).toBeLessThan(1);
        expect(actor.home.y).toBeGreaterThan(0);
        expect(actor.home.y).toBeLessThan(1);
        expect(actor.maxHp).toBeGreaterThan(0);
      }
    }
  });

  it('los 17 tipos de evento tienen animacion', () => {
    const vistos = new Set<FightEvent['type']>();
    const animados = new Set<FightEvent['type']>();

    for (let seed = 0; seed < 600; seed++) {
      const result = fight(seed);
      for (const event of result.log as FightEvent[]) vistos.add(event.type);

      const scene = planFight(result);
      // `start` no pinta nada y es correcto: no genera beat.
      const conMoves = scene.beats.filter((b) => b.moves.length > 0).length;
      expect(conMoves).toBe(scene.beats.length);
    }

    // Cada tipo que aparece en algun combate debe producir movimiento.
    for (const type of vistos) {
      if (type === 'start') continue;
      const scene = planFight({
        winner: 'A',
        log: [
          {
            type: 'spawn',
            id: 'A',
            name: 'A',
            side: 'A',
            isPet: false,
            hp: 10,
            maxHp: 10,
            weapon: 'punos',
          },
          {
            type: 'spawn',
            id: 'B',
            name: 'B',
            side: 'B',
            isPet: false,
            hp: 10,
            maxHp: 10,
            weapon: 'punos',
          },
          muestra(type),
        ],
      });
      const ultimo = scene.beats.at(-1);
      if ((ultimo?.moves.length ?? 0) === 0) throw new Error(`${type} no anima nada`);
      animados.add(type);
    }

    expect(vistos.size).toBe(17);
    expect(animados.size).toBe(16);
  }, 30_000);

  it('el pie de escena usa nombres y no ids', () => {
    const scene = planFight(fight(3));
    const captions = scene.beats.map((b) => b.caption).filter((c) => c !== null);

    expect(captions.length).toBeGreaterThan(0);
    for (const caption of captions) {
      expect(caption).not.toMatch(/\b[AB]-pet-\d\b/);
    }
  });
});

/** Un evento minimo de cada tipo, para comprobar que ninguno se queda sin animar. */
function muestra(type: FightEvent['type']): FightEvent {
  switch (type) {
    case 'spawn':
      return { type, id: 'C', name: 'C', side: 'A', isPet: true, hp: 5, maxHp: 5, weapon: 'punos' };
    case 'turn':
      return { type, id: 'A' };
    case 'move':
    case 'attack':
      return type === 'move'
        ? { type, id: 'A', target: 'B' }
        : { type, id: 'A', target: 'B', weapon: 'punos' };
    case 'hit':
      return { type, id: 'A', target: 'B' };
    case 'evade':
    case 'block':
      return { type, id: 'B' };
    case 'counter':
      return { type, id: 'B', target: 'A' };
    case 'damage':
      return { type, id: 'B', amount: 3, hp: 7 };
    case 'heal':
      return { type, id: 'A', amount: 3, hp: 10 };
    case 'drawWeapon':
      return { type, id: 'A', weapon: 'chaira' };
    case 'throwWeapon':
      return { type, id: 'A', target: 'B', weapon: 'cascote' };
    case 'disarm':
      return { type, id: 'A', target: 'B', weapon: 'chaira' };
    case 'skill':
      return { type, id: 'A', skill: 'revire' };
    case 'death':
      return { type, id: 'B' };
    case 'end':
      return { type, winner: 'A', turns: 4 };
    default:
      throw new Error(`sin muestra para ${type}`);
  }
}
