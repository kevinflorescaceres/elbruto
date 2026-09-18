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
