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

/** Arma por defecto. No se ofrece al subir de nivel: todos pelean con ella. */
export const FISTS: Weapon = {
  id: 'punos',
  name: 'Punos',
  category: 'rapida',
  damage: 5,
  accuracy: 85,
  baseDelay: 8,
  strengthScale: 60,
  reach: 1,
  throwable: false,
};

export const WEAPONS: readonly Weapon[] = [
  // Rapidas: poco dano, muchos turnos.
  {
    id: 'chaira',
    name: 'Chaira',
    category: 'rapida',
    damage: 12,
    accuracy: 90,
    baseDelay: 6,
    strengthScale: 70,
    reach: 1,
    throwable: false,
  },
  {
    id: 'jifero',
    name: 'Jifero',
    category: 'rapida',
    damage: 17,
    accuracy: 84,
    baseDelay: 8,
    strengthScale: 80,
    reach: 1,
    throwable: false,
  },
  {
    id: 'puntilla',
    name: 'Puntilla',
    category: 'rapida',
    damage: 13,
    accuracy: 88,
    baseDelay: 7,
    strengthScale: 75,
    reach: 1,
    throwable: true,
  },
  // Pesadas: mucho dano, lentas, imprecisas.
  {
    id: 'porra',
    name: 'Porra de Corchete',
    category: 'pesada',
    damage: 31,
    accuracy: 76,
    baseDelay: 13,
    strengthScale: 120,
    reach: 1,
    throwable: false,
  },
  {
    id: 'banqueta',
    name: 'Banqueta de Taberna',
    category: 'pesada',
    damage: 38,
    accuracy: 70,
    baseDelay: 15,
    strengthScale: 130,
    reach: 2,
    throwable: false,
  },
  {
    id: 'tranca',
    name: 'Tranca de Porton',
    category: 'pesada',
    damage: 45,
    accuracy: 63,
    baseDelay: 17,
    strengthScale: 150,
    reach: 2,
    throwable: false,
  },
  // Largas: alcance y precision, dano medio.
  {
    id: 'verduguillo',
    name: 'Verduguillo',
    category: 'larga',
    damage: 19,
    accuracy: 86,
    baseDelay: 9,
    strengthScale: 80,
    reach: 3,
    throwable: false,
  },
  {
    id: 'chuzo',
    name: 'Chuzo de Sereno',
    category: 'larga',
    damage: 22,
    accuracy: 80,
    baseDelay: 11,
    strengthScale: 95,
    reach: 3,
    throwable: true,
  },
  // Arrojadizas: un buen golpe y se acaban.
  {
    id: 'cascote',
    name: 'Cascote',
    category: 'arrojadiza',
    damage: 24,
    accuracy: 78,
    baseDelay: 10,
    strengthScale: 60,
    reach: 3,
    throwable: true,
  },
  {
    id: 'botija',
    name: 'Botija de Vino',
    category: 'arrojadiza',
    damage: 29,
    accuracy: 72,
    baseDelay: 11,
    strengthScale: 55,
    reach: 3,
    throwable: true,
  },
];

export const SKILLS: readonly Skill[] = [
  // Pasivas.
  {
    id: 'cuero-curtido',
    name: 'Cuero Curtido',
    type: 'pasiva',
    effect: { kind: 'maxHp', amount: 16 },
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
    effect: { kind: 'stat', stat: 'agility', amount: 3 },
  },
  {
    id: 'brazo-de-fragua',
    name: 'Brazo de Fragua',
    type: 'pasiva',
    effect: { kind: 'stat', stat: 'strength', amount: 3 },
  },
  {
    id: 'resuello',
    name: 'Resuello',
    type: 'pasiva',
    effect: { kind: 'stat', stat: 'speed', amount: 3 },
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
    effect: { kind: 'heal', percent: 40 },
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

export const PETS: readonly Pet[] = [
  {
    id: 'chucho',
    name: 'Chucho',
    hp: 20,
    damage: 4,
    accuracy: 80,
    baseDelay: 10,
    agility: 5,
  },
  {
    id: 'mastin',
    name: 'Mastin',
    hp: 30,
    damage: 6,
    accuracy: 75,
    baseDelay: 13,
    agility: 2,
  },
  {
    id: 'jabali',
    name: 'Jabali',
    hp: 32,
    damage: 8,
    accuracy: 68,
    baseDelay: 16,
    agility: 0,
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
