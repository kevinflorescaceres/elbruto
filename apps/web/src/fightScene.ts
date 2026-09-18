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
import type { FightEvent } from '@rufianes/engine';
import type { FightReplay } from '@rufianes/shared';
import { describe } from './fightLines.js';

export interface Actor {
  id: string;
  name: string;
  side: 'A' | 'B';
  isPet: boolean;
  maxHp: number;
  weapon: string;
  /** Sitio en el suelo al que vuelve siempre. */
  home: { x: number; y: number };
  /** Hacia donde mira: 1 a la derecha, -1 a la izquierda. */
  facing: 1 | -1;
}

export type Move =
  /** Entra en escena. */
  | { kind: 'appear'; id: string }
  /** Se acerca al objetivo y vuelve. */
  | { kind: 'approach'; id: string; toward: string }
  /** Embiste: golpe seco hacia el objetivo. */
  | { kind: 'lunge'; id: string; toward: string }
  /** Encaja: retrocede y se sacude. */
  | { kind: 'shake'; id: string }
  /** Salta hacia atras esquivando. */
  | { kind: 'hop'; id: string }
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
  /** Cae derribado y se apaga. */
  | { kind: 'fall'; id: string }
  /** Da un brinco de victoria. */
  | { kind: 'cheer'; id: string };

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

const COLOR = {
  dano: 0xcc3333,
  cura: 0x44aa77,
  parada: 0x4477cc,
  maña: 0xccaa33,
} as const;

/** Duracion de cada tipo de evento, en segundos. Se ajustan a ojo. */
const DURATION: Record<FightEvent['type'], number> = {
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
  if (!isPet) return { x: bruteX, y: 0.62 };
  // Las mascotas quedan detras del suyo y algo mas abajo, sin salirse del lienzo.
  return { x: bruteX - facing * (0.11 + petIndex * 0.06), y: 0.78 };
}

export function planFight(replay: Pick<FightReplay, 'log' | 'winner'>): Scene {
  const actors: Actor[] = [];
  const byId = new Map<string, Actor>();
  const petCount = { A: 0, B: 0 };
  const beats: Beat[] = [];
  let at = 0;

  const push = (event: FightEvent, moves: Move[]): void => {
    const duration = DURATION[event.type];
    if (moves.length === 0 && duration === 0) return;
    const names = (id: string): string => byId.get(id)?.name ?? id;
    beats.push({ at, duration, caption: describe(event, names), moves });
    at += duration;
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
        push(event, [{ kind: 'approach', id: event.id, toward: event.target }]);
        break;

      case 'attack':
        push(event, [{ kind: 'lunge', id: event.id, toward: event.target }]);
        break;

      case 'hit':
        push(event, [{ kind: 'shake', id: event.target }]);
        break;

      case 'evade':
        push(event, [{ kind: 'hop', id: event.id }]);
        break;

      case 'block':
        push(event, [
          { kind: 'flash', id: event.id, color: COLOR.parada },
          { kind: 'shake', id: event.id },
        ]);
        break;

      case 'counter':
        push(event, [{ kind: 'lunge', id: event.id, toward: event.target }]);
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
        push(event, [{ kind: 'fall', id: event.id }]);
        break;

      case 'end':
        push(event, [{ kind: 'cheer', id: event.winner }]);
        break;
    }
  }

  return { actors, beats, duration: at };
}
