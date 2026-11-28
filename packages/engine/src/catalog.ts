/**
 * Catalogo del juego: armas, habilidades y mascotas.
 *
 * Nombres, ids y efectos ORIGINALES de este proyecto (PLAN.md §11). El tono es
 * el hampa de taberna del Siglo de Oro: armas improvisadas y germania. No son
 * traducciones ni variantes de ningun otro juego.
 *
 * Los numeros son valores iniciales: los ajusta `pnpm balance` (PLAN.md §6).
 */
import type { Pet, Skill, Weapon } from './types.js';

/**
 * Valores de partida de COMBATE.md §4.3 y §4.5, por categoria, con variacion
 * por arma dentro de cada una. Se ajustan con `pnpm balance`.
 *
 *   categoria    intervalo  dano  combo  esquivable
 *   rapida            55      5     20      dificil
 *   media             80      9     10      normal
 *   larga             95     10      5      normal
 *   pesada           140     20      0      facil
 *   arrojadiza        70      7      0      normal
 */

/** Arma por defecto. No se ofrece al subir de nivel: todos pelean con ella. */
export const FISTS: Weapon = {
  id: 'punos',
  name: 'Puños',
  category: 'rapida',
  // 6 y no 3: desde que el nivel 1 empieza sin arma, con 3 el combate se iba a
  // 37 impactos de 3 de dano. Con 6 vuelve a ~21 impactos, como cuando habia arma.
  damage: 6,
  accuracyBonus: 4,
  interval: 66,
  comboRate: 12,
  strengthScale: 60,
  reach: 1,
  throwable: false,
  stock: null,
  breakChance: 0,
};

export const WEAPONS: readonly Weapon[] = [
  // Rapidas: pegan poco y a menudo, y son dificiles de esquivar.
  {
    id: 'chaira',
    name: 'Chaira',
    category: 'rapida',
    damage: 6,
    accuracyBonus: 5,
    interval: 50,
    comboRate: 19,
    strengthScale: 60,
    reach: 1,
    throwable: false,
    stock: null,
    breakChance: 1,
  },
  {
    id: 'puntilla',
    name: 'Puntilla',
    category: 'rapida',
    damage: 7,
    accuracyBonus: 4,
    interval: 56,
    comboRate: 16,
    strengthScale: 62,
    reach: 1,
    throwable: false,
    stock: null,
    breakChance: 1,
  },
  // Medias: el termino medio en todo.
  {
    id: 'jifero',
    name: 'Jifero',
    category: 'media',
    damage: 9,
    accuracyBonus: 4,
    interval: 76,
    comboRate: 12,
    strengthScale: 75,
    reach: 1,
    throwable: false,
    stock: null,
    breakChance: 2,
  },
  {
    id: 'porra',
    name: 'Porra de Corchete',
    category: 'media',
    damage: 10,
    accuracyBonus: 3,
    interval: 84,
    comboRate: 8,
    strengthScale: 85,
    reach: 2,
    throwable: false,
    stock: null,
    breakChance: 4,
  },
  // Largas: alcance y contraataque.
  {
    id: 'verduguillo',
    name: 'Verduguillo',
    category: 'larga',
    damage: 10,
    accuracyBonus: 4,
    interval: 88,
    comboRate: 7,
    strengthScale: 80,
    reach: 3,
    throwable: false,
    stock: null,
    breakChance: 2,
  },
  {
    id: 'chuzo',
    name: 'Chuzo de Sereno',
    category: 'larga',
    damage: 13,
    accuracyBonus: 1,
    interval: 102,
    comboRate: 4,
    strengthScale: 95,
    reach: 4,
    throwable: false,
    stock: null,
    breakChance: 5,
  },
  {
    id: 'vara',
    name: 'Vara de Fresno',
    category: 'larga',
    damage: 9,
    accuracyBonus: 3,
    interval: 86,
    comboRate: 6,
    strengthScale: 75,
    reach: 4,
    throwable: false,
    stock: null,
    // Madera verde y flexible: dobla antes de partirse.
    breakChance: 1,
  },
  // Pesadas: un golpe hace mucho, pero llega tarde y se ve venir.
  {
    id: 'banqueta',
    name: 'Banqueta de Taberna',
    category: 'pesada',
    damage: 22,
    accuracyBonus: -3,
    interval: 132,
    comboRate: 0,
    strengthScale: 110,
    reach: 2,
    throwable: false,
    stock: null,
    breakChance: 30,
  },
  {
    id: 'tranca',
    name: 'Tranca de Portón',
    category: 'pesada',
    damage: 22,
    accuracyBonus: -6,
    interval: 150,
    comboRate: 0,
    strengthScale: 130,
    reach: 2,
    throwable: false,
    stock: null,
    breakChance: 8,
  },
  // Arrojadizas: solo se lanzan, traen un numero de tiros por combate (`stock`) y
  // el dano va con la mana. Las de un tiro revientan contra el rival.
  {
    id: 'cascote',
    name: 'Cascote',
    category: 'arrojadiza',
    damage: 10,
    accuracyBonus: 3,
    interval: 64,
    comboRate: 0,
    strengthScale: 70,
    reach: 3,
    throwable: true,
    stock: 3,
    breakChance: 0,
  },
  {
    id: 'botija',
    name: 'Botija de Vino',
    category: 'arrojadiza',
    damage: 24,
    accuracyBonus: 1,
    interval: 76,
    comboRate: 0,
    strengthScale: 70,
    reach: 3,
    throwable: true,
    stock: 1,
    breakChance: 0,
  },
  {
    id: 'garrafa',
    name: 'Garrafa de Greda',
    category: 'arrojadiza',
    damage: 28,
    accuracyBonus: -4,
    interval: 90,
    comboRate: 0,
    strengthScale: 70,
    reach: 3,
    throwable: true,
    stock: 1,
    breakChance: 0,
  },
  {
    id: 'cuchillos',
    name: 'Cuchillos de Tiro',
    category: 'arrojadiza',
    damage: 8,
    accuracyBonus: 5,
    interval: 56,
    comboRate: 0,
    strengthScale: 60,
    reach: 3,
    throwable: true,
    stock: 5,
    breakChance: 0,
  },
];

export const SKILLS: readonly Skill[] = [
  // Pasivas.
  {
    id: 'cuero-curtido',
    name: 'Cuero Curtido',
    type: 'pasiva',
    effect: { kind: 'lastStand' },
  },
  {
    id: 'callo-viejo',
    name: 'Callo Viejo',
    type: 'pasiva',
    effect: { kind: 'armor', amount: 2 },
  },
  {
    id: 'pies-ligeros',
    name: 'Pies Ligeros',
    type: 'pasiva',
    effect: { kind: 'afterDodge', combo: 15 },
  },
  {
    id: 'brazo-de-fragua',
    name: 'Brazo de Fragua',
    type: 'pasiva',
    effect: { kind: 'firstBlow', multiplier: 2 },
  },
  {
    id: 'resuello',
    name: 'Resuello',
    type: 'pasiva',
    effect: { kind: 'secondWind', below: 30, speed: 12 },
  },
  {
    id: 'mano-zurda',
    name: 'Mano Zurda',
    type: 'pasiva',
    effect: { kind: 'block', chance: 15 },
  },
  {
    id: 'revire',
    name: 'Revire',
    type: 'pasiva',
    effect: { kind: 'counter', chance: 20 },
  },
  // Activas: una vez por combate.
  {
    id: 'trago-largo',
    name: 'Trago Largo',
    type: 'activa',
    effect: { kind: 'heal', percent: 50 },
  },
  {
    id: 'zurriagazo',
    name: 'Zurriagazo',
    type: 'activa',
    effect: { kind: 'power', multiplier: 2 },
  },
  {
    id: 'desjarrete',
    name: 'Desjarrete',
    type: 'activa',
    effect: { kind: 'disarm' },
  },
];

/**
 * Las mascotas pelean por ti, pero te cuestan resistencia (COMBATE.md §4.8):
 * eres mas fragil a cambio de tener otro cuerpo en la pelea.
 */
export const PETS: readonly Pet[] = [
  {
    id: 'chucho',
    name: 'Chucho',
    hp: 26,
    damage: 5,
    accuracyBonus: 6,
    interval: 80,
    agility: 5,
    enduranceCost: 2,
  },
  {
    id: 'mastin',
    name: 'Mastín',
    hp: 46,
    damage: 9,
    accuracyBonus: 2,
    interval: 105,
    agility: 2,
    enduranceCost: 3,
  },
  {
    id: 'jabali',
    name: 'Jabalí',
    hp: 72,
    damage: 17,
    accuracyBonus: -2,
    interval: 130,
    agility: 0,
    enduranceCost: 6,
  },
];

const byId = <T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> =>
  new Map(items.map((item) => [item.id, item]));

const WEAPONS_BY_ID = byId([FISTS, ...WEAPONS]);
const SKILLS_BY_ID = byId(SKILLS);
const PETS_BY_ID = byId(PETS);

function required<T>(map: ReadonlyMap<string, T>, id: string, what: string): T {
  const item = map.get(id);
  if (item === undefined) throw new Error(`${what} desconocida: ${id}`);
  return item;
}

export const getWeapon = (id: string): Weapon => required(WEAPONS_BY_ID, id, 'Arma');
export const getSkill = (id: string): Skill => required(SKILLS_BY_ID, id, 'Habilidad');
export const getPet = (id: string): Pet => required(PETS_BY_ID, id, 'Mascota');
