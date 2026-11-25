import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo } from './brute.js';
import { porCategoria } from './sensacion.js';
import { mulberry32 } from './prng.js';
import { simulate } from './simulate.js';
import type { FightEvent } from './types.js';

/** Criterios de aceptacion de COMBATE.md §6. */

function pelea(seed: number, level = 1, pets: string[] = []) {
  const rng = mulberry32(seed);
  const a = { ...growTo(createBrute(`comb-${seed}-a`), level, rng), pets };
  const b = growTo(createBrute(`comb-${seed}-b`), level, rng);
  return simulate(a, b, seed * 7 + 5);
}

group('combos', () => {
  it('nunca encadenan mas de 3 impactos, y cada uno pega menos que el anterior', () => {
    for (let seed = 0; seed < 600; seed++) {
      const log = pelea(seed, (seed % 20) + 1).log as FightEvent[];
      let enCadena = 0;
      let anterior = Infinity;

      for (const event of log) {
        if (event.type === 'attack' || event.type === 'counter') {
          enCadena = 0;
          anterior = Infinity;
          continue;
        }
        if (event.type !== 'damage') continue;

        enCadena += 1;
        if (enCadena > 3) throw new Error(`semilla ${seed}: cadena de ${enCadena} impactos`);
        // <= y no <: el dano tiene suelo de 1, asi que dos seguidos pueden valer 1.
        if (event.amount > anterior) {
          throw new Error(`semilla ${seed}: ${event.amount} despues de ${anterior}`);
        }
        anterior = event.amount;
      }
    }
  });
});

group('integridad del log', () => {
  it('nada ocurre despues del evento end', () => {
    for (let seed = 0; seed < 400; seed++) {
      const log = pelea(seed, (seed % 30) + 1).log as FightEvent[];
      const fin = log.findIndex((e) => e.type === 'end');
      expect(fin).toBeGreaterThan(-1);
      expect(fin).toBe(log.length - 1);
    }
  });

  it('el dano recibido cuadra con la vida perdida', () => {
    for (let seed = 0; seed < 400; seed++) {
      const log = pelea(seed, (seed % 30) + 1, seed % 4 === 0 ? ['chucho'] : [])
        .log as FightEvent[];
      const inicial = new Map<string, number>();
      const balance = new Map<string, number>();
      const ultima = new Map<string, number>();

      for (const event of log) {
        if (event.type === 'spawn') {
          inicial.set(event.id, event.hp);
          balance.set(event.id, 0);
          ultima.set(event.id, event.hp);
        } else if (event.type === 'damage' || event.type === 'heal') {
          const signo = event.type === 'damage' ? -1 : 1;
          balance.set(event.id, (balance.get(event.id) ?? 0) + signo * event.amount);
          ultima.set(event.id, event.hp);
        }
      }

      // Curarse tiene tope, y el tope descuadra la suma: se mide sin curaciones.
      if (log.some((e) => e.type === 'heal')) continue;

      for (const [id, fin] of ultima) {
        const esperado = (inicial.get(id) ?? 0) + (balance.get(id) ?? 0);
        // Al morir, el dano sobrante se recorta en 0: la suma queda en negativo.
        if (fin === 0) expect(esperado).toBeLessThanOrEqual(0);
        else expect(fin).toBe(esperado);
      }
    }
  });
});

group('equilibrio', () => {
  it('ninguna categoria de arma domina ni es inutil a nivel 1', () => {
    // Cara a cara entre categorias distintas. Medir "tener arma contra no
    // tenerla" daria 86% para todas: eso mide arma > mania, no dominancia.
    for (const [cat, fila] of porCategoria(1500)) {
      if (fila.con < 60) continue;
      const tasa = (fila.gana / fila.con) * 100;
      if (tasa > 60 || tasa < 40) {
        throw new Error(`${cat} gana el ${tasa.toFixed(1)}% (n=${fila.con})`);
      }
    }
  });

  it('el primer golpe se reparte cerca del 50/50', () => {
    let primeroA = 0;
    const total = 1500;

    for (let seed = 0; seed < total; seed++) {
      const log = pelea(seed, (seed % 10) + 1).log as FightEvent[];
      const primero = log.find((e) => e.type === 'turn');
      if (primero?.type === 'turn' && primero.id === 'A') primeroA += 1;
    }

    const porcentaje = (primeroA / total) * 100;
    expect(porcentaje).toBeGreaterThan(45);
    expect(porcentaje).toBeLessThan(55);
  });
});

/** Combates donde A lleva la mana pedida, de varios niveles. */
function conMana(skill: string, combates = 300) {
  return Array.from({ length: combates }, (_, seed) => {
    const rng = mulberry32(seed + 900);
    const nivel = (seed % 20) + 1;
    const base = growTo(createBrute(`mana-${skill}-${seed}-a`), nivel, rng);
    const a = base.skills.includes(skill) ? base : { ...base, skills: [...base.skills, skill] };
    const b = growTo(createBrute(`mana-${skill}-${seed}-b`), nivel, rng);
    return { log: simulate(a, b, seed * 13 + 1).log as FightEvent[], b };
  });
}

const disparos = (log: FightEvent[], skill: string) =>
  log.flatMap((e, i) => (e.type === 'skill' && e.id === 'A' && e.skill === skill ? [i] : []));

group('manas de disparo (motor 5)', () => {
  it('Cuero Curtido deja de pie con 1 de vida, una sola vez, y corta el combo', () => {
    let vistos = 0;
    for (const { log } of conMana('cuero-curtido')) {
      const veces = disparos(log, 'cuero-curtido');
      expect(veces.length).toBeLessThanOrEqual(1);
      for (const i of veces) {
        vistos++;
        const golpe = log[i - 1];
        expect(golpe).toMatchObject({ type: 'damage', id: 'A', hp: 1 });
        // Lo siguiente no es otro impacto del mismo combo.
        expect(log[i + 1]?.type).not.toBe('hit');
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('Resuello salta una vez, al bajar del 30% de vida', () => {
    let vistos = 0;
    for (const { log } of conMana('resuello')) {
      const veces = disparos(log, 'resuello');
      expect(veces.length).toBeLessThanOrEqual(1);
      const maxHp = log.find((e) => e.type === 'spawn' && e.id === 'A');
      for (const i of veces) {
        vistos++;
        const golpe = log
          .slice(0, i)
          .reverse()
          .find((e) => e.type === 'damage' && e.id === 'A');
        if (golpe?.type !== 'damage' || maxHp?.type !== 'spawn') throw new Error('sin golpe');
        expect(golpe.hp * 100).toBeLessThanOrEqual(30 * maxHp.maxHp);
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('Pies Ligeros: tras esquivar, el siguiente ataque no se esquiva', () => {
    let vistos = 0;
    for (const { log } of conMana('pies-ligeros')) {
      for (const i of disparos(log, 'pies-ligeros')) {
        vistos++;
        expect(log[i - 1]).toMatchObject({ type: 'attack', id: 'A' });
        expect(log[i + 1]?.type).not.toBe('evade');
        // Y antes hubo una esquiva suya sin gastar.
        expect(log.slice(0, i).some((e) => e.type === 'evade' && e.id === 'A')).toBe(true);
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('Brazo de Fragua carga el primer golpe que entra, una sola vez', () => {
    let vistos = 0;
    for (const { log } of conMana('brazo-de-fragua')) {
      const veces = disparos(log, 'brazo-de-fragua');
      expect(veces.length).toBeLessThanOrEqual(1);
      for (const i of veces) {
        vistos++;
        expect(log[i + 1]).toMatchObject({ type: 'hit', id: 'A' });
        // Es el primer impacto de A en el combate.
        expect(log.slice(0, i).some((e) => e.type === 'hit' && e.id === 'A')).toBe(false);
      }
    }
    expect(vistos).toBeGreaterThan(0);
  });

  it('Desjarrete sirve contra quien va a punos: el tajo golpea igual', () => {
    let aPunos = 0;
    for (const { log } of conMana('desjarrete')) {
      for (const i of disparos(log, 'desjarrete')) {
        const siguiente = log.slice(i + 1).find((e) => e.type !== 'disarm' && e.type !== 'move');
        expect(siguiente).toMatchObject({ type: 'attack', id: 'A' });
        if (log[i + 1]?.type !== 'disarm') aPunos++;
      }
    }
    expect(aPunos).toBeGreaterThan(0);
  });
});
