import { describe, expect, it } from 'vitest';
import { growBot } from './bots.js';
import { createBrute, growTo } from './brute.js';
import { hashString, mulberry32 } from './prng.js';
import { simulate } from './simulate.js';

const bot = (name: string, level: number) =>
  growBot(createBrute(name), level, mulberry32(hashString(`bot:${name}`)));

describe('growBot', () => {
  it('llega al nivel pedido y es determinista', () => {
    const a = bot('Tuerto de la Cava 7', 7);
    expect(a.level).toBe(7);
    expect(bot('Tuerto de la Cava 7', 7)).toEqual(a);
  });

  it('a nivel 1 no toca nada: es el peleon recien creado', () => {
    expect(bot('Zurdo el Rufo 1', 1)).toEqual(createBrute('Zurdo el Rufo 1'));
  });

  it('elige mejor que tirar una moneda', () => {
    // Mismo nombre, mismas opciones en cada nivel: solo cambia quien elige.
    let gana = 0;
    let total = 0;
    for (let i = 0; i < 12; i++) {
      const nombre = `comparado ${i}`;
      const listo = bot(nombre, 10);
      const azar = growTo(createBrute(nombre), 10, mulberry32(hashString(`azar:${nombre}`)));
      for (let k = 0; k < 20; k++) {
        const lado = k % 2 === 0;
        const res = lado ? simulate(listo, azar, k) : simulate(azar, listo, k);
        if ((res.winner === 'A') === lado) gana += 1;
        total += 1;
      }
    }
    // Era > 0.55 con el motor 4, cuando 3 puntos de estadistica valian mas que
    // casi cualquier arma o mana y elegir bien era elegir siempre los puntos.
    // Con el motor 5 las dos opciones de cada nivel valen parecido (ver
    // `frenteAPuntos` en `pnpm balance`), y elegir con cabeza da poco: 0.51.
    // Lo que se protege es que el bot no elija PEOR que una moneda.
    expect(gana / total).toBeGreaterThan(0.5);
  });
});
