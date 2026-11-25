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
import { escenarioDe } from './art/escenarios.js';
import { cuentaComoPrevio, describe } from './fightLines.js';

export interface Actor {
  id: string;
  name: string;
  side: 'A' | 'B';
  isPet: boolean;
  maxHp: number;
  weapon: string;
  /** Solo los luchadores tienen rig; las mascotas se dibujan de una pieza. */
  appearance: Appearance | null;
  /** Del snapshot. Deriva los campos de apariencia que no esten guardados. */
  slug: string;
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
  /** Embiste desde esa distancia y SE QUEDA: el combo encadena ahi mismo. */
  | { kind: 'lunge'; id: string; toward: string; weapon: string }
  /** Vuelve a su sitio de espera. Se emite al cerrar el turno, no antes. */
  | { kind: 'retreat'; id: string }
  /** Toca una animacion del rig por su nombre (ver `art/poses.ts`). */
  /** `parada`: el golpe acaba contra una guardia (ver `animacion`). */
  | { kind: 'pose'; id: string; anim: AnimName; parada?: boolean }
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
  /**
   * El contacto de un golpe sobre `id`: chispa del lado por el que llega (el
   * que mira al rival) y temblor segun el dano. `parada` es un golpe que choca
   * con la guardia: chispa de metal y sin temblor.
   */
  | { kind: 'impact'; id: string; fuerza: number; parada: boolean }
  /** Anillo que se expande alrededor. */
  | { kind: 'ring'; id: string; color: number }
  /** Latido breve: marca de quien tiene el turno. */
  | { kind: 'pulse'; id: string }
  /** Se apaga al morir. */
  | { kind: 'fall'; id: string }
  /**
   * Cartel de apertura o de cierre. `queda` lo deja fijo en vez de
   * desvanecerlo: el de cierre dice quien gano y es el remate de la pelea, asi
   * que tiene que seguir ahi cuando la linea de tiempo se para.
   */
  | { kind: 'announce'; text: string; grande: boolean; queda: boolean };

/**
 * El pie de escena entero en un instante, no un cambio respecto al anterior:
 * al saltar o repetir, el ultimo pie que dispare GSAP basta para dejarlo bien.
 *
 * Antes cada evento cambiaba el pie, y una accion traia hasta cuatro frases en
 * poco mas de un segundo: la mediana de lo que duraba cada una era 0,36 s.
 */
export interface Pie {
  /**
   * Lo que se ve: las frases de la accion en curso, que van sumandose hasta que
   * empieza la siguiente. Solo lo que el lienzo no cuenta por si solo.
   */
  linea: string[];
  /** La accion en curso entera, para quien no ve el lienzo. Reutiliza la fase 3. */
  narracion: string[];
  /** Que accion es. Al cambiar, el lector de pantalla empieza de cero. */
  accion: number;
}

export interface Beat {
  /** Segundos desde el principio. */
  at: number;
  duration: number;
  /** El pie desde este momento, o null si no cambia. */
  pie: Pie | null;
  moves: Move[];
}

/**
 * Lo que va en la linea visible. Fuera: el dano (numero flotante y barra), la
 * esquiva y la parada (su pose y su chispa) y la curacion (numero verde). El
 * contraataque no falta: lo cuenta el `attack` que lo sigue.
 */
const EN_LA_LINEA: ReadonlySet<FightEvent['type']> = new Set([
  'attack',
  'drawWeapon',
  'throwWeapon',
  'disarm',
  'skill',
  'death',
  'end',
]);

export interface Scene {
  actors: Actor[];
  beats: Beat[];
  duration: number;
  /** Indice del fondo. Sale de la semilla, asi que la repeticion no cambia. */
  escenario: number;
}

/** Un evento ya descrito, todavia sin hora: solo sabe cuanto pesa en su turno. */
interface Crudo {
  type: FightEvent['type'];
  weight: number;
  /** La frase entera, para la narracion. */
  caption: string | null;
  /** La forma corta, para la linea visible. */
  linea: string | null;
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

  const cerrarConRetirada = (): void => {
    // Quien embistio vuelve a su sitio al ACABAR el turno, no tras el primer
    // golpe: si volviera antes, los impactos de un combo saldrian desde lejos
    // en vez de encadenarse en el sitio (COMBATE.md §5).
    const embestida = actual.flatMap((c) => c.moves).find((m) => m.kind === 'lunge');
    if (embestida !== undefined && embestida.kind === 'lunge') {
      actual.push({
        type: 'turn',
        weight: PESO_RETIRADA,
        caption: null,
        linea: null,
        moves: [
          { kind: 'retreat', id: embestida.id },
          { kind: 'pose', id: embestida.id, anim: 'walk' },
        ],
      });
    }
    cerrar();
  };

  for (const crudo of crudos) {
    // `start`, `turn` y `end` abren grupo: son las fronteras del combate.
    if (crudo.type === 'turn' || crudo.type === 'end' || crudo.type === 'start') {
      cerrarConRetirada();
    }
    actual.push(crudo);
    if (crudo.type === 'end') cerrar();
  }
  cerrarConRetirada();

  const beats: Beat[] = [];
  let at = 0;
  // Si una accion no trae nada para la linea, se queda la de la anterior.
  let lineaAnterior: string[] = [];

  for (const [accion, grupo] of grupos.entries()) {
    const esTurno = grupo.some((c) => c.type === 'turn');
    const esCierre = grupo.some((c) => c.type === 'end');
    const esApertura = grupo.some((c) => c.type === 'start');
    const contras = grupo.filter((c) => c.type === 'counter').length;

    const total = esCierre
      ? SEGUNDOS_DE_CIERRE
      : esApertura
        ? SEGUNDOS_DE_APERTURA
        : esTurno
          ? SEGUNDOS_POR_ACCION * (1 + contras)
          : SEGUNDOS_DE_ENTRADA;

    // El respiro sale del final del turno: se reparte lo que queda.
    const util = esTurno ? Math.max(0, total - RESPIRO) : total;
    const peso = grupo.reduce((suma, c) => suma + c.weight, 0);
    let usado = 0;
    const linea: string[] = [];
    const narracion: string[] = [];

    for (const crudo of grupo) {
      // Si todo el grupo pesa 0, se reparte a partes iguales.
      const parte = peso > 0 ? crudo.weight / peso : 1 / grupo.length;
      const duration = util * parte;
      let pie: Pie | null = null;
      if (crudo.caption !== null) {
        narracion.push(crudo.caption);
        if (EN_LA_LINEA.has(crudo.type) && crudo.linea !== null) linea.push(crudo.linea);
        pie = {
          linea: linea.length > 0 ? [...linea] : lineaAnterior,
          narracion: [...narracion],
          accion,
        };
      }
      beats.push({ at, duration, pie, moves: crudo.moves });
      at += duration;
      usado += duration;
    }
    if (linea.length > 0) lineaAnterior = linea;
    // Lo que sobra es la quietud antes de que actue el otro.
    at += total - usado;
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
/** El cartel de apertura, despues de que entren los dos. */
const SEGUNDOS_DE_APERTURA = 1.2 * TIME_SCALE;

/**
 * Peso de cada evento dentro de su turno, en los milisegundos de referencia de
 * COMBATE.md §5. No son tiempos absolutos: son la parte del turno que le toca a
 * cada uno, y TIME_SCALE escala el conjunto.
 */
const WEIGHT: Record<FightEvent['type'], number> = {
  start: 0,
  spawn: 120,
  turn: 60,
  move: 300,
  attack: 300,
  hit: 100,
  evade: 300,
  block: 350,
  counter: 450,
  damage: 250,
  heal: 350,
  drawWeapon: 400,
  throwWeapon: 500,
  disarm: 400,
  skill: 350,
  death: 800,
  end: 900,
};

/** Lo que tarda en volver a su sitio tras golpear (COMBATE.md §5). */
const PESO_RETIRADA = 300;

/**
 * Quietud al final de cada turno, para que no se pise la accion de uno con la
 * del otro (COMBATE.md §5). Sale del propio turno, asi que las acciones siguen
 * empezando exactamente cada SEGUNDOS_POR_ACCION.
 */
const RESPIRO = 0.15 * TIME_SCALE;

/** Coloca a cada bando: A mira a la derecha, B a la izquierda. */
function placeActor(side: 'A' | 'B', isPet: boolean, petIndex: number): Actor['home'] {
  const facing = side === 'A' ? 1 : -1;
  // Centrados y a 360 px uno de otro: en 1440 eso es 540 y 900. La separacion
  // la manda el recorte de movil, que solo deja ver la franja central: un
  // cuerpo tendido mide casi 200 px y tiene que caber entero.
  const bruteX = side === 'A' ? 0.375 : 0.625;
  // La y es la del SUELO: el rig cuelga hacia arriba desde los pies.
  if (!isPet) return { x: bruteX, y: 0.85 };
  // Las mascotas, detras del suyo y un pelin por delante en profundidad.
  return { x: bruteX - facing * (0.069 + petIndex * 0.0375), y: 0.88 };
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
export type Replayable = Pick<FightReplay, 'log' | 'winner' | 'seed'> & {
  snapshotA: { appearance: Appearance; slug: string };
  snapshotB: { appearance: Appearance; slug: string };
};

export function planFight(replay: Replayable): Scene {
  const actors: Actor[] = [];
  const byId = new Map<string, Actor>();
  const petCount = { A: 0, B: 0 };
  const crudos: Crudo[] = [];
  let eventoPrevio: FightEvent | null = null;

  const push = (event: FightEvent, moves: Move[]): void => {
    const weight = WEIGHT[event.type];
    if (moves.length === 0 && weight === 0) return;
    const names = (id: string): string => byId.get(id)?.name ?? id;
    crudos.push({
      type: event.type,
      weight,
      caption: describe(event, names, { previo: eventoPrevio }),
      linea: describe(event, names, { previo: eventoPrevio, corto: true }),
      moves,
    });
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
          slug: (event.side === 'A' ? replay.snapshotA : replay.snapshotB).slug,
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
        push(event, [
          { kind: 'pose', id: event.target, anim: 'hit' },
          { kind: 'impact', id: event.target, fuerza: 0, parada: false },
        ]);
        break;

      case 'evade':
        push(event, [{ kind: 'pose', id: event.id, anim: 'evade' }]);
        break;

      case 'block': {
        // El ataque ya esta en el guion: se cambia por su version parada, que
        // apunta a la guardia en vez de a la cara.
        for (let i = crudos.length - 1; i >= 0; i--) {
          const golpe = crudos[i]?.moves.find(
            (m) => m.kind === 'pose' && m.id !== event.id && m.anim.startsWith('attack'),
          );
          if (golpe === undefined) continue;
          if (golpe.kind === 'pose') golpe.parada = true;
          break;
        }
        push(event, [
          // Sin destello: cualquier tinte oscurece (Pixi multiplica) y una
          // parada que oscurece al que para se lee como un golpe encajado.
          { kind: 'pose', id: event.id, anim: 'block' },
          { kind: 'impact', id: event.id, fuerza: 0, parada: true },
        ]);
        break;
      }

      case 'damage': {
        const moves: Move[] = [
          { kind: 'hp', id: event.id, hp: event.hp },
          { kind: 'float', id: event.id, text: `-${event.amount}`, color: COLOR.dano },
          { kind: 'flash', id: event.id, color: COLOR.dano },
        ];
        // El dano de un golpe va EN el golpe: el destello, el numero y la
        // barra caen en el mismo instante en que el rival lo acusa. Separados,
        // el impacto se leia en tres tiempos.
        const previo = crudos.at(-1);
        const impacto =
          previo?.type === 'hit' ? previo.moves.find((m) => m.kind === 'impact') : undefined;
        if (previo !== undefined && impacto?.kind === 'impact' && impacto.id === event.id) {
          impacto.fuerza = event.amount;
          previo.moves.push(...moves);
          previo.weight += WEIGHT.damage;
          previo.caption = describe(event, (id) => byId.get(id)?.name ?? id);
          break;
        }
        push(event, moves);
        break;
      }

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

      case 'end': {
        const ganador = byId.get(event.winner)?.name ?? event.winner;
        push(event, [
          { kind: 'pose', id: event.winner, anim: 'victory' },
          { kind: 'announce', text: `Gana ${ganador}`, grande: false, queda: true },
        ]);
        break;
      }
    }
    // `push` lo lee mientras se describe el evento; aqui ya cuenta para el siguiente.
    if (cuentaComoPrevio(event)) eventoPrevio = event;
  }

  // El cartel de apertura va DESPUES de que entren los dos, no antes: si no,
  // saluda a un escenario vacio.
  const ultimoSpawn = crudos.map((c) => c.type).lastIndexOf('spawn');
  if (ultimoSpawn >= 0) {
    crudos.splice(ultimoSpawn + 1, 0, {
      type: 'start',
      weight: 1,
      caption: null,
      linea: null,
      moves: [{ kind: 'announce', text: '¡Camorra!', grande: true, queda: false }],
    });
  }

  const { beats, duration } = repartirTiempo(crudos);
  return { actors, beats, duration, escenario: escenarioDe(replay.seed) };
}
