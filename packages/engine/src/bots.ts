/**
 * Como crecen los bots del seed. Con `growTo` eligen a cara o cruz, y un jugador
 * que elige con cabeza les ganaba el 60-70% a partir de nivel 2. Aqui eligen
 * como ese jugador: prueban las dos opciones contra rivales de su nivel y se
 * quedan con la que mas gana.
 *
 * Vive en su propio archivo porque necesita `simulate`, que ya importa de
 * `brute.ts`: meterlo alli seria una importacion circular.
 */
import { applyLevelUpOption, createBrute, growTo, rollLevelUpOptions } from './brute.js';
import { hashString, mulberry32, randInt, type Rng } from './prng.js';
import { simulate } from './simulate.js';
import type { Brute } from './types.js';

/** Rivales de prueba por nivel y combates contra cada uno. 32 simulaciones por eleccion. */
const RIVALES = 8;
const COMBATES = 2;

/**
 * Rivales de referencia: peleones que crecen al azar, como la poblacion media.
 * Salen de nombres fijos, asi que son siempre los mismos para un nivel dado.
 */
function rivalesDeNivel(level: number): Brute[] {
  return Array.from({ length: RIVALES }, (_, i) => {
    const base = createBrute(`referencia ${level} ${i}`);
    return growTo(base, level, mulberry32(hashString(`referencia:${base.slug}`)));
  });
}

function victorias(peleon: Brute, rivales: readonly Brute[], rng: Rng): number {
  let gana = 0;
  for (const rival of rivales) {
    for (let k = 0; k < COMBATES; k++) {
      // Un combate de cada lado: el que empieza tiene una ligera ventaja.
      const lado = k % 2 === 0;
      const seed = randInt(rng, 0, 2 ** 30);
      const res = lado ? simulate(peleon, rival, seed) : simulate(rival, peleon, seed);
      if ((res.winner === 'A') === lado) gana += 1;
    }
  }
  return gana;
}

/** Sube a un bot hasta `targetLevel` quedandose en cada nivel con la mejor de las dos opciones. */
export function growBot(brute: Brute, targetLevel: number, rng: Rng): Brute {
  const rivales = new Map<number, Brute[]>();
  let next = brute;
  while (next.level < targetLevel) {
    const level = next.level + 1;
    if (!rivales.has(level)) rivales.set(level, rivalesDeNivel(level));
    const contra = rivales.get(level) ?? [];

    const [a, b] = rollLevelUpOptions(next).map((option) => ({
      ...applyLevelUpOption(next, option),
      level,
    }));
    if (a === undefined || b === undefined) break;
    // A igualdad, la primera: es la de estadistica, la que nunca estorba.
    next = victorias(b, contra, rng) > victorias(a, contra, rng) ? b : a;
  }
  return next;
}
