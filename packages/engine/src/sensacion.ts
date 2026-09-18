/**
 * Mide los objetivos de sensacion de COMBATE.md §3. Son objetivos propios del
 * proyecto, no datos de nadie: se ajustan las constantes hasta entrar en rango.
 */
import { createBrute, growTo } from './brute.js';
import { WEAPONS } from './catalog.js';
import { mulberry32, randInt } from './prng.js';
import { simulate } from './simulate.js';
import type { FightEvent, FightResult } from './types.js';

export interface Medida {
  nombre: string;
  valor: number;
  min: number;
  max: number;
  unidad: string;
}

interface Bruto {
  impactos: number;
  acciones: number;
  dano: number;
  ataques: number;
  fallados: number;
  conCombo: number;
  racha: number;
  tope: boolean;
}

/** Recorre un combate una vez y saca todo lo que hace falta. */
export function medirCombate(result: FightResult): Bruto {
  const log = result.log as FightEvent[];
  let impactos = 0;
  let acciones = 0;
  let dano = 0;
  let ataques = 0;
  let fallados = 0;
  let conCombo = 0;
  let racha = 0;

  let actor: string | null = null;
  let seguidas = 0;
  // Impactos dentro de la accion en curso: 2 o mas es un combo.
  let impactosDeLaAccion = 0;

  const cerrarAccion = (): void => {
    if (impactosDeLaAccion >= 2) conCombo += 1;
    impactosDeLaAccion = 0;
  };

  for (const event of log) {
    switch (event.type) {
      case 'turn': {
        cerrarAccion();
        acciones += 1;
        seguidas = event.id === actor ? seguidas + 1 : 1;
        actor = event.id;
        racha = Math.max(racha, seguidas);
        break;
      }
      case 'attack':
        ataques += 1;
        break;
      case 'evade':
      case 'block':
        fallados += 1;
        break;
      case 'damage':
        impactos += 1;
        impactosDeLaAccion += 1;
        dano += event.amount;
        break;
      default:
        break;
    }
  }
  cerrarAccion();

  return {
    impactos,
    acciones,
    dano,
    ataques,
    fallados,
    conCombo,
    racha,
    tope: result.turns >= 500,
  };
}

/** Combate entre dos luchadores del nivel dado, sin mascotas (COMBATE.md §3). */
export function medir(combates: number, level: number): Medida[] {
  const rng = mulberry32(0x5e5a);
  const suma: Bruto = {
    impactos: 0,
    acciones: 0,
    dano: 0,
    ataques: 0,
    fallados: 0,
    conCombo: 0,
    racha: 0,
    tope: false,
  };
  let topes = 0;
  let rachas = 0;

  for (let i = 0; i < combates; i++) {
    // growTo, no un `level` puesto a mano: si no, serian peleones de nivel 1 con
    // la vida de nivel 10 y las metricas no medirian nada real.
    const a = { ...growTo(createBrute(`sens-${level}-${i}-a`), level, rng), pets: [] };
    const b = { ...growTo(createBrute(`sens-${level}-${i}-b`), level, rng), pets: [] };
    const m = medirCombate(simulate(a, b, randInt(rng, 0, 2 ** 30)));

    suma.impactos += m.impactos;
    suma.acciones += m.acciones;
    suma.dano += m.dano;
    suma.ataques += m.ataques;
    suma.fallados += m.fallados;
    suma.conCombo += m.conCombo;
    rachas += m.racha;
    if (m.tope) topes += 1;
  }

  const media = (v: number): number => v / combates;
  return [
    { nombre: 'impactos por combate', valor: media(suma.impactos), min: 12, max: 25, unidad: '' },
    { nombre: 'acciones por combate', valor: media(suma.acciones), min: 20, max: 40, unidad: '' },
    {
      nombre: 'dano medio por impacto',
      valor: suma.impactos > 0 ? suma.dano / suma.impactos : 0,
      min: 5,
      max: 12,
      unidad: '',
    },
    {
      nombre: 'combates al tope de turnos',
      valor: (topes / combates) * 100,
      min: 0,
      max: 0.5,
      unidad: '%',
    },
    {
      nombre: 'acciones con combo',
      valor: suma.acciones > 0 ? (suma.conCombo / suma.acciones) * 100 : 0,
      min: 10,
      max: 25,
      unidad: '%',
    },
    {
      nombre: 'ataques que no conectan',
      valor: suma.ataques > 0 ? (suma.fallados / suma.ataques) * 100 : 0,
      min: 20,
      max: 35,
      unidad: '%',
    },
    { nombre: 'racha maxima seguida', valor: rachas / combates, min: 2, max: 4, unidad: '' },
  ];
}

/**
 * Victorias por categoria de arma, con AMBOS armados y con armas de distinta
 * clase. Medir "tener arma contra no tenerla" no sirve: a nivel 1 eso da 86%
 * para cualquier categoria, porque mide que un arma vale mas que una mania, no
 * que una categoria domine a otra.
 */
export function porCategoria(combates: number): Map<string, { con: number; gana: number }> {
  const rng = mulberry32(0xca7);
  const tabla = new Map<string, { con: number; gana: number }>();

  for (let i = 0; i < combates; i++) {
    const a = createBrute(`cat-${i}-a`);
    const b = createBrute(`cat-${i}-b`);
    const ganaA = simulate(a, b, randInt(rng, 0, 2 ** 30)).winner === 'A';

    for (const [brute, gano] of [
      [a, ganaA],
      [b, !ganaA],
    ] as const) {
      const rival = brute === a ? b : a;
      if (brute.weapons.length === 0 || rival.weapons.length === 0) continue;
      const suya = categoriaDe(brute.weapons[0]);
      const otra = categoriaDe(rival.weapons[0]);
      if (suya === undefined || otra === undefined || suya === otra) continue;

      const fila = tabla.get(suya) ?? { con: 0, gana: 0 };
      fila.con += 1;
      if (gano) fila.gana += 1;
      tabla.set(suya, fila);
    }
  }
  return tabla;
}

const categoriaDe = (id: string | undefined): string | undefined =>
  id === undefined ? undefined : WEAPONS.find((w) => w.id === id)?.category;
