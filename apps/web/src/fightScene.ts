/**
 * Del log del motor a un guion de animacion. Puro: ni Pixi ni GSAP ni DOM.
 *
 * Existe separado para poder probarlo. Canvas y WebGL no corren en Node, asi
 * que si el guion se construyera dentro del componente, el criterio de la fase
 * ("cualquier combate guardado se reproduce sin errores") no seria verificable.
 *
 * Las coordenadas van en 0..1 sobre el ancho y alto del lienzo: el renderer las
 * escala y el guion no sabe nada de pixeles.
 */
import { getWeapon, type Appearance, type FightEvent } from '@camorra/engine';
import type { FightReplay } from '@camorra/shared';
import type { AnimName } from './art/poses.js';
import { describe } from './fightLines.js';

export interface Actor {
  id: string;
  name: string;
  side: 'A' | 'B';
  isPet: boolean;
  maxHp: number;
  weapon: string;
  /** Solo los luchadores tienen rig; las mascotas se dibujan de una pieza. */
  appearance: Appearance | null;
  /** Id de catalogo de la mascota, para elegir su silueta. */
  petId: string | null;
  /** Sitio en el suelo al que vuelve siempre. */
  home: { x: number; y: number };
  /** Hacia donde mira: 1 a la derecha, -1 a la izquierda. */
  facing: 1 | -1;
}

export type Move =
  /** Entra en escena. */
  | { kind: 'appear'; id: string }
  /** Se planta a distancia de golpe y se queda ahi. */
  | { kind: 'approach'; id: string; toward: string; weapon: string }
  /** Embiste desde esa distancia y vuelve a su sitio. */
  | { kind: 'lunge'; id: string; toward: string; weapon: string }
  /** Toca una animacion del rig por su nombre (ver `art/poses.ts`). */
  | { kind: 'pose'; id: string; anim: AnimName }
  /** Destello de color (parada, maña, curacion). */
  | { kind: 'flash'; id: string; color: number }
  /** Mueve la barra de vida a su nuevo valor. */
  | { kind: 'hp'; id: string; hp: number }
  /** Numero que sube y se desvanece. */
  | { kind: 'float'; id: string; text: string; color: number }
  /** Cambia el arma que lleva en la mano. */
  | { kind: 'weapon'; id: string; weapon: string }
  /** Proyectil que cruza de uno a otro. */
  | { kind: 'projectile'; from: string; to: string; weapon: string }
  /** El arma sale volando y cae al suelo. */
  | { kind: 'toss'; id: string; weapon: string }
  /** Anillo que se expande alrededor. */
  | { kind: 'ring'; id: string; color: number }
  /** Latido breve: marca de quien tiene el turno. */
  | { kind: 'pulse'; id: string }
  /** Se apaga al morir. */
  | { kind: 'fall'; id: string };

export interface Beat {
  /** Segundos desde el principio. */
  at: number;
  duration: number;
  /** Linea de texto para el pie de escena. Reutiliza la de la fase 3. */
  caption: string | null;
  moves: Move[];
}

export interface Scene {
  actors: Actor[];
  beats: Beat[];
  duration: number;
}

/** Un evento ya descrito, todavia sin hora: solo sabe cuanto pesa en su turno. */
interface Crudo {
  type: FightEvent['type'];
  weight: number;
  caption: string | null;
  moves: Move[];
}

/**
 * Reparte el tiempo. Los eventos se agrupan por turno y cada turno recibe su
 * segundo, que sus eventos se reparten segun su peso. Un contraataque es una
 * accion mas de un peleon, asi que anade otro segundo a ese turno.
 */
function repartirTiempo(crudos: Crudo[]): { beats: Beat[]; duration: number } {
  const grupos: Crudo[][] = [];
  let actual: Crudo[] = [];
  const cerrar = (): void => {
    if (actual.length > 0) grupos.push(actual);
    actual = [];
  };

  for (const crudo of crudos) {
    // `turn` y `end` abren grupo: son las fronteras naturales del combate.
    if (crudo.type === 'turn' || crudo.type === 'end') cerrar();
    actual.push(crudo);
    if (crudo.type === 'end') cerrar();
  }
  cerrar();

  const beats: Beat[] = [];
  let at = 0;

  for (const grupo of grupos) {
    const esTurno = grupo.some((c) => c.type === 'turn');
    const esCierre = grupo.some((c) => c.type === 'end');
    const contras = grupo.filter((c) => c.type === 'counter').length;

    const total = esCierre
      ? SEGUNDOS_DE_CIERRE
      : esTurno
        ? SEGUNDOS_POR_ACCION * (1 + contras)
        : SEGUNDOS_DE_ENTRADA;

    const peso = grupo.reduce((suma, c) => suma + c.weight, 0);
    for (const crudo of grupo) {
      // Si todo el grupo pesa 0, se reparte a partes iguales.
      const parte = peso > 0 ? crudo.weight / peso : 1 / grupo.length;
      const duration = total * parte;
      beats.push({ at, duration, caption: crudo.caption, moves: crudo.moves });
      at += duration;
    }
  }

  return { beats, duration: at };
}

const COLOR = {
  dano: 0xcc3333,
  cura: 0x44aa77,
  parada: 0x4477cc,
  maña: 0xccaa33,
} as const;

/**
 * Mando unico del ritmo (COMBATE.md §5). Subirlo ralentiza el combate entero:
 * los gestos dentro de una accion y la espera entre la accion de uno y la del
 * otro, porque ambos salen del mismo reparto.
 */
export const TIME_SCALE = 1.5;

/**
 * Un turno es una accion de un peleon, y dura lo mismo siempre: el combate se
 * sigue con la vista sin tirones. Antes cada evento traia su propia duracion y
 * un turno podia durar 0,32 s (sacar un arma) o 2,0 s (ataque con contraataque).
 */
export const SEGUNDOS_POR_ACCION = 1 * TIME_SCALE;
/** La entrada en escena de todos los combatientes, junta. */
const SEGUNDOS_DE_ENTRADA = 0.8 * TIME_SCALE;
/** El remate final: merece respirar. */
const SEGUNDOS_DE_CIERRE = 1.4 * TIME_SCALE;

/**
 * Peso de cada evento DENTRO de su turno. Ya no son segundos: son la parte del
 * segundo que le toca a cada uno.
 */
const WEIGHT: Record<FightEvent['type'], number> = {
  start: 0,
  spawn: 0.12,
  turn: 0.06,
  move: 0.22,
  attack: 0.26,
  hit: 0.08,
  evade: 0.26,
  block: 0.26,
  counter: 0.22,
  damage: 0.3,
  heal: 0.34,
  drawWeapon: 0.26,
  throwWeapon: 0.45,
  disarm: 0.4,
  skill: 0.34,
  death: 0.55,
  end: 0.9,
};

/** Coloca a cada bando: A mira a la derecha, B a la izquierda. */
function placeActor(side: 'A' | 'B', isPet: boolean, petIndex: number): Actor['home'] {
  const facing = side === 'A' ? 1 : -1;
  const bruteX = side === 'A' ? 0.28 : 0.72;
  // La y es la del SUELO: el rig cuelga hacia arriba desde los pies.
  if (!isPet) return { x: bruteX, y: 0.85 };
  // Las mascotas, detras del suyo y un pelin por delante en profundidad.
  return { x: bruteX - facing * (0.11 + petIndex * 0.06), y: 0.88 };
}

/** La categoria del arma decide el gesto. Las mascotas muerden: gesto rapido. */
function attackAnim(weaponId: string): AnimName {
  if (weaponId.startsWith('pet:')) return 'attackRapida';
  switch (getWeapon(weaponId).category) {
    case 'pesada':
      return 'attackPesada';
    case 'larga':
      return 'attackLarga';
    case 'arrojadiza':
      return 'attackArrojadiza';
    default:
      return 'attackRapida';
  }
}

/** Solo se necesita la apariencia de los snapshots, no la ficha entera. */
export type Replayable = Pick<FightReplay, 'log' | 'winner'> & {
  snapshotA: { appearance: Appearance };
  snapshotB: { appearance: Appearance };
};

export function planFight(replay: Replayable): Scene {
  const actors: Actor[] = [];
  const byId = new Map<string, Actor>();
  const petCount = { A: 0, B: 0 };
  const crudos: Crudo[] = [];

  const push = (event: FightEvent, moves: Move[]): void => {
    const weight = WEIGHT[event.type];
    if (moves.length === 0 && weight === 0) return;
    const names = (id: string): string => byId.get(id)?.name ?? id;
    crudos.push({ type: event.type, weight, caption: describe(event, names), moves });
  };

  for (const event of replay.log as FightEvent[]) {
    switch (event.type) {
      case 'start':
        break;

      case 'spawn': {
        const petIndex = event.isPet ? petCount[event.side]++ : 0;
        const actor: Actor = {
          id: event.id,
          name: event.name,
          side: event.side,
          isPet: event.isPet,
          maxHp: event.maxHp,
          weapon: event.weapon,
          appearance: event.isPet
            ? null
            : (event.side === 'A' ? replay.snapshotA : replay.snapshotB).appearance,
          petId: event.isPet ? event.weapon.replace('pet:', '') : null,
          home: placeActor(event.side, event.isPet, petIndex),
          facing: event.side === 'A' ? 1 : -1,
        };
        actors.push(actor);
        byId.set(actor.id, actor);
        push(event, [{ kind: 'appear', id: event.id }]);
        break;
      }

      case 'turn':
        push(event, [{ kind: 'pulse', id: event.id }]);
        break;

      case 'move':
        push(event, [
          {
            kind: 'approach',
            id: event.id,
            toward: event.target,
            weapon: byId.get(event.id)?.weapon ?? 'punos',
          },
          { kind: 'pose', id: event.id, anim: 'walk' },
        ]);
        break;

      case 'attack':
        push(event, [
          { kind: 'lunge', id: event.id, toward: event.target, weapon: event.weapon },
          { kind: 'pose', id: event.id, anim: attackAnim(event.weapon) },
        ]);
        break;

      // El contraataque no dice con que: es con lo que se tenga en la mano.
      case 'counter':
        push(event, [
          {
            kind: 'lunge',
            id: event.id,
            toward: event.target,
            weapon: byId.get(event.id)?.weapon ?? 'punos',
          },
          { kind: 'pose', id: event.id, anim: attackAnim(byId.get(event.id)?.weapon ?? 'punos') },
        ]);
        break;

      case 'hit':
        push(event, [{ kind: 'pose', id: event.target, anim: 'hit' }]);
        break;

      case 'evade':
        push(event, [{ kind: 'pose', id: event.id, anim: 'evade' }]);
        break;

      case 'block':
        push(event, [
          { kind: 'pose', id: event.id, anim: 'block' },
          { kind: 'flash', id: event.id, color: COLOR.parada },
        ]);
        break;

      case 'damage':
        push(event, [
          { kind: 'hp', id: event.id, hp: event.hp },
          { kind: 'float', id: event.id, text: `-${event.amount}`, color: COLOR.dano },
          { kind: 'flash', id: event.id, color: COLOR.dano },
        ]);
        break;

      case 'heal':
        push(event, [
          { kind: 'hp', id: event.id, hp: event.hp },
          { kind: 'float', id: event.id, text: `+${event.amount}`, color: COLOR.cura },
          { kind: 'flash', id: event.id, color: COLOR.cura },
        ]);
        break;

      case 'drawWeapon': {
        const actor = byId.get(event.id);
        if (actor !== undefined) actor.weapon = event.weapon;
        push(event, [{ kind: 'weapon', id: event.id, weapon: event.weapon }]);
        break;
      }

      case 'throwWeapon':
        push(event, [
          { kind: 'pose', id: event.id, anim: 'throw' },
          { kind: 'projectile', from: event.id, to: event.target, weapon: event.weapon },
          { kind: 'weapon', id: event.id, weapon: 'punos' },
        ]);
        break;

      case 'disarm':
        push(event, [
          { kind: 'toss', id: event.target, weapon: event.weapon },
          { kind: 'weapon', id: event.target, weapon: 'punos' },
        ]);
        break;

      case 'skill':
        push(event, [
          { kind: 'ring', id: event.id, color: COLOR.maña },
          { kind: 'flash', id: event.id, color: COLOR.maña },
        ]);
        break;

      case 'death':
        push(event, [
          { kind: 'pose', id: event.id, anim: 'death' },
          { kind: 'fall', id: event.id },
        ]);
        break;

      case 'end':
        push(event, [{ kind: 'pose', id: event.winner, anim: 'victory' }]);
        break;
    }
  }

  const { beats, duration } = repartirTiempo(crudos);
  return { actors, beats, duration };
}
