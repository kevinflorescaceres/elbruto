/** Tipos del motor. Fuente de verdad: `packages/shared` construye los esquemas Zod encima. */

export type Stat = 'endurance' | 'strength' | 'agility' | 'speed';

export type WeaponCategory = 'rapida' | 'media' | 'larga' | 'pesada' | 'arrojadiza';

export interface Weapon {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  /** Cuesta esquivarla: se resta de la probabilidad de esquiva (COMBATE.md §4.6). */
  accuracyBonus: number;
  /** Tiempo entre acciones antes de aplicar velocidad (COMBATE.md §4.3). */
  interval: number;
  /** Probabilidad base de encadenar otro impacto (COMBATE.md §4.2). */
  comboRate: number;
  /** Porcentaje de la fuerza que se suma al dano. */
  strengthScale: number;
  /** 1 cuerpo a cuerpo, 4 muy larga. Solo afecta a la animacion. */
  reach: number;
  /** Las arrojadizas solo se lanzan, y no se agotan (COMBATE.md §2). */
  throwable: boolean;
}

export type SkillEffect =
  | { kind: 'stat'; stat: Stat; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'armor'; amount: number }
  | { kind: 'block'; chance: number }
  | { kind: 'counter'; chance: number }
  | { kind: 'heal'; percent: number }
  | { kind: 'power'; multiplier: number }
  | { kind: 'disarm' };

export interface Skill {
  id: string;
  name: string;
  /** pasiva: se aplica al construir el combatiente. activa: se usa una vez por combate. */
  type: 'pasiva' | 'activa';
  effect: SkillEffect;
}

export interface Pet {
  id: string;
  name: string;
  hp: number;
  damage: number;
  accuracyBonus: number;
  interval: number;
  agility: number;
  /** Lo que le cuesta al dueno en resistencia (COMBATE.md §4.8). */
  enduranceCost: number;
}

/** Variantes de dibujo derivadas del nombre. Las consume el arte (Fase 5). */
export interface Appearance {
  body: number;
  head: number;
  hair: number;
  skinColor: number;
  hairColor: number;
  clothColor: number;
}

export interface Brute {
  name: string;
  slug: string;
  level: number;
  xp: number;
  endurance: number;
  strength: number;
  agility: number;
  speed: number;
  weapons: string[];
  skills: string[];
  pets: string[];
  appearance: Appearance;
}

export type LevelUpOption =
  | { type: 'weapon'; id: string }
  | { type: 'skill'; id: string }
  | { type: 'pet'; id: string }
  | { type: 'stat'; gains: Partial<Record<Stat, number>> };

export type Side = 'A' | 'B';

/** Combatiente vivo dentro de una simulacion. */
export interface Combatant {
  id: string;
  name: string;
  side: Side;
  isPet: boolean;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  speed: number;
  /** Armas disponibles todavia sin lanzar. */
  weapons: Weapon[];
  weapon: Weapon;
  armor: number;
  block: number;
  counter: number;
  /** Habilidades activas sin gastar. */
  actives: Skill[];
  /** Momento de su proxima accion en la cola de iniciativa. */
  next: number;
}

export type FightEvent =
  | { type: 'start'; seed: number }
  | {
      type: 'spawn';
      id: string;
      name: string;
      side: Side;
      isPet: boolean;
      hp: number;
      maxHp: number;
      weapon: string;
    }
  | { type: 'turn'; id: string }
  | { type: 'move'; id: string; target: string }
  | { type: 'attack'; id: string; target: string; weapon: string }
  | { type: 'hit'; id: string; target: string }
  | { type: 'evade'; id: string }
  | { type: 'block'; id: string }
  | { type: 'counter'; id: string; target: string }
  | { type: 'damage'; id: string; amount: number; hp: number }
  | { type: 'heal'; id: string; amount: number; hp: number }
  | { type: 'drawWeapon'; id: string; weapon: string }
  | { type: 'throwWeapon'; id: string; target: string; weapon: string }
  | { type: 'disarm'; id: string; target: string; weapon: string }
  | { type: 'skill'; id: string; skill: string }
  | { type: 'death'; id: string }
  | { type: 'end'; winner: Side; turns: number };

export type FightEventType = FightEvent['type'];

export interface FightResult {
  engineVersion: number;
  seed: number;
  winner: Side;
  turns: number;
  log: FightEvent[];
}
