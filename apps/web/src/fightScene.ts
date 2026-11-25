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
import { getSkill, getWeapon, type Appearance, type FightEvent } from '@camorra/engine';
import type { FightReplay } from '@camorra/shared';
import type { Expresion } from './art/parts.js';
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
  /** `encadena`: sigue a otro golpe del mismo turno, sin volver a reposo. */
  /** `remata`: el ultimo golpe de un combo, que se carga y se sostiene mas. */
  | {
      kind: 'pose';
      id: string;
      anim: AnimName;
      parada?: boolean;
      encadena?: boolean;
      remata?: boolean;
    }
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
   * Cambia la cara mientras dura el beat; con `queda`, hasta el final. Las
   * mascotas no tienen cara y la ignoran. La pista entera la arma `pistaDeCaras`.
   */
  | { kind: 'face'; id: string; cara: Expresion; queda?: boolean }
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
 * esquiva y la parada (su pose y un letrero flotante, como el del dano) y la
 * curacion (numero verde). El contraataque no falta: lo cuenta el `attack` que
 * lo sigue. Y el final tampoco: "Se acabó en N turnos" tapaba la caida, que es
 * lo que de verdad cierra el combate. El ganador ya lo dice el cartel.
 */
const EN_LA_LINEA: ReadonlySet<FightEvent['type']> = new Set([
  'attack',
  'drawWeapon',
  'throwWeapon',
  'disarm',
  'skill',
  'death',
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
    // en vez de encadenarse en el sitio (COMBATE.md §5). Vuelven TODOS los que
    // se movieron: quien contraataca tambien se planta, y si se quedara alli el
    // siguiente que fuera a por el lo cruzaria y pegaria al aire.
    const movidos = new Set<string>();
    for (const m of actual.flatMap((c) => c.moves)) {
      if (m.kind === 'lunge' || m.kind === 'approach') movidos.add(m.id);
    }
    if (movidos.size > 0) {
      actual.push({
        type: 'turn',
        weight: PESO_RETIRADA,
        caption: null,
        linea: null,
        moves: [...movidos].flatMap((id): Move[] => [
          { kind: 'retreat', id },
          { kind: 'pose', id, anim: 'walk' },
        ]),
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
  let narracionAnterior: string[] = [];
  let accionAnterior = -1;

  for (const [indice, grupo] of grupos.entries()) {
    const esTurno = grupo.some((c) => c.type === 'turn');
    const esCierre = grupo.some((c) => c.type === 'end');
    // El cierre sigue la ultima accion en vez de empezar otra: para el lector
    // de pantalla, "Se acabó" se suma a la caida en lugar de borrarla.
    const accion = esCierre ? accionAnterior : indice;
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
    const narracion: string[] = esCierre ? [...narracionAnterior] : [];

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
    if (narracion.length > 0) {
      narracionAnterior = narracion;
      accionAnterior = accion;
    }
    // Lo que sobra es la quietud antes de que actue el otro.
    at += total - usado;
  }

  return { beats, duration: at };
}

const COLOR = {
  dano: 0xcc3333,
  cura: 0x44aa77,
  parada: 0x4477cc,
  esquiva: 0xf4efe4,
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

/**
 * La categoria del arma decide el gesto. Las mascotas muerden: gesto rapido.
 *
 * `serie` es el numero de golpe dentro del combo, desde 0. A punos el combo
 * alterna las manos (uno-dos): el segundo es un cruzado del brazo de atras, y
 * el tercero vuelve al de delante. Con arma pega siempre la mano que la lleva.
 */
function attackAnim(weaponId: string, serie = 0): AnimName {
  if (weaponId.startsWith('pet:')) return 'attackRapida';
  if (weaponId === 'punos') return serie % 2 === 1 ? 'attackCruzado' : 'attackRapida';
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
  // La serie de golpes en curso: de quien es, con que arma, cuantos golpes
  // lleva dados (desde 0) y cuantos impactos ha tenido el ultimo ataque. La
  // cortan el cambio de turno y el golpe de otro: un contraataque abre la suya.
  let serie = { id: '', arma: 'punos', golpes: 0, impactos: 0 };
  const golpe = (id: string, arma: string): number => {
    serie =
      serie.id === id
        ? { id, arma, golpes: serie.golpes + 1, impactos: 0 }
        : { id, arma, golpes: 0, impactos: 0 };
    return serie.golpes;
  };
  // El golpe del ultimo impacto de la serie: el remate. Solo se sabe que era
  // el ultimo cuando llega otra cosa, asi que se marca al cerrar la serie.
  let ultimoGolpe: (Move & { kind: 'pose' }) | null = null;
  const rematar = (): void => {
    if (ultimoGolpe !== null) ultimoGolpe.remata = true;
    ultimoGolpe = null;
  };

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
        rematar();
        serie = { id: '', arma: 'punos', golpes: 0, impactos: 0 };
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

      case 'attack': {
        rematar();
        const n = golpe(event.id, event.weapon);
        push(event, [
          { kind: 'lunge', id: event.id, toward: event.target, weapon: event.weapon },
          {
            kind: 'pose',
            id: event.id,
            anim: attackAnim(event.weapon, n),
            ...(n > 0 && { encadena: true }),
          },
          { kind: 'face', id: event.id, cara: 'esfuerzo' },
        ]);
        break;
      }

      // El contraataque no dice con que: es con lo que se tenga en la mano.
      case 'counter':
        rematar();
        push(event, [
          {
            kind: 'lunge',
            id: event.id,
            toward: event.target,
            weapon: byId.get(event.id)?.weapon ?? 'punos',
          },
          { kind: 'pose', id: event.id, anim: attackAnim(byId.get(event.id)?.weapon ?? 'punos') },
          { kind: 'face', id: event.id, cara: 'esfuerzo' },
        ]);
        break;

      case 'hit': {
        // Del segundo impacto de un combo en adelante, el motor no manda otro
        // `attack`: solo el `hit`. Sin esto el rival acusaba golpes que nadie
        // daba. El golpe va en el beat ANTERIOR (el del impacto previo), que es
        // donde se estira para que su contacto caiga justo al empezar este.
        if (serie.id === event.id && ++serie.impactos > 1) {
          serie.golpes++;
          const siguiente: Move & { kind: 'pose' } = {
            kind: 'pose',
            id: event.id,
            anim: attackAnim(serie.arma, serie.golpes),
            encadena: true,
          };
          crudos.at(-1)?.moves.push(siguiente);
          ultimoGolpe = siguiente;
        }
        push(event, [
          { kind: 'pose', id: event.target, anim: 'hit' },
          { kind: 'impact', id: event.target, fuerza: 0, parada: false },
          { kind: 'face', id: event.target, cara: 'dolor' },
        ]);
        break;
      }

      // Un golpe sin numero no se distinguia de uno que te perdiste: el fallo se
      // dice donde se diria el dano. Un tercio de las acciones acaba asi.
      case 'evade':
        push(event, [
          { kind: 'pose', id: event.id, anim: 'evade' },
          // El que esquiva se ha salido con la suya: media sonrisa.
          { kind: 'face', id: event.id, cara: 'socarrona' },
          { kind: 'float', id: event.id, text: '¡Esquiva!', color: COLOR.esquiva },
        ]);
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
          { kind: 'face', id: event.id, cara: 'esfuerzo' },
          { kind: 'impact', id: event.id, fuerza: 0, parada: true },
          { kind: 'float', id: event.id, text: '¡Parada!', color: COLOR.parada },
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
          { kind: 'face', id: event.id, cara: 'esfuerzo' },
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

      // El nombre de la maña flota sobre quien la usa: las de disparo (Resuello,
      // Cuero Curtido...) no tienen otro gesto propio, y sin letrero pasaban.
      case 'skill':
        push(event, [
          { kind: 'ring', id: event.id, color: COLOR.maña },
          { kind: 'flash', id: event.id, color: COLOR.maña },
          {
            kind: 'float',
            id: event.id,
            text: `¡${getSkill(event.skill).name}!`,
            color: COLOR.maña,
          },
        ]);
        break;

      case 'death':
        push(event, [
          { kind: 'pose', id: event.id, anim: 'death' },
          { kind: 'fall', id: event.id },
          { kind: 'face', id: event.id, cara: 'derrotado', queda: true },
        ]);
        break;

      case 'end': {
        const ganador = byId.get(event.winner)?.name ?? event.winner;
        // La risa va con la caida del otro, no con el cartel: esperar al cierre
        // dejaba al ganador con cara de nada casi un segundo justo en el remate.
        const risa: Move = { kind: 'face', id: event.winner, cara: 'alegria', queda: true };
        const caida = [...crudos].reverse().find((c) => c.type === 'death');
        if (caida !== undefined) caida.moves.push(risa);
        push(event, [
          { kind: 'pose', id: event.winner, anim: 'victory' },
          ...(caida === undefined ? [risa] : []),
          { kind: 'announce', text: `Gana ${ganador}`, grande: false, queda: true },
        ]);
        break;
      }
    }
    // `push` lo lee mientras se describe el evento; aqui ya cuenta para el siguiente.
    if (cuentaComoPrevio(event)) eventoPrevio = event;
  }
  rematar();

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

/** Un cambio de cara en la pista de un peleon. */
export interface CambioDeCara {
  at: number;
  cara: Expresion;
}

/**
 * Lo minimo que dura un gesto. En un combo el beat del golpe es corto, y un
 * `> <` de 0,1 s no llega a verse.
 */
const GESTO_MINIMO = 0.35 * TIME_SCALE;
/** Lo que dura un parpadeo: lo justo para notarlo sin que parezca un guino. */
export const PARPADEO = 0.13;
/** Entre parpadeo y parpadeo, de ESPERA_MIN a ESPERA_MIN + ESPERA_VARIA segundos. */
const ESPERA_MIN = 2.2;
const ESPERA_VARIA = 2.4;
/**
 * Aire antes de un gesto: cerrar, abrir y `> <` en menos de medio segundo se
 * veia como un chispazo, no como dos cosas. Va en tiempo de la escena y no
 * crece con la velocidad: si creciera, a x2 se comia todos los ratos
 * tranquilos y los ojos no volvian a cerrarse.
 */
const AIRE_ANTES_DE_GESTO = 0.35;
/**
 * Un parpadeo que toca poco despues de soltar un gesto sale del propio gesto
 * (gesto, ojos cerrados, neutral) en vez de dejar antes un respiro neutral:
 * gesto, neutral, cerrar y abrir en 0,85 s era un tic.
 */
const PEGADO_AL_GESTO = 0.6;
/**
 * Hueco minimo de cara tranquila entre dos gestos, en tiempo real. Por debajo
 * el gesto anterior se alarga hasta el siguiente: a x2 asomaban destellos de
 * neutral de 0,2 s que se leian como parpadeos rotos.
 */
const PUENTE = 0.3;

/**
 * La cara de cada peleon a lo largo del combate, como lista de cambios
 * ordenada. Empieza en `neutral` sin decirlo.
 *
 * Cada gesto dura su beat (o `GESTO_MINIMO`), y el siguiente lo corta si llega
 * antes. Los de `queda` (KO y victoria) ya no se cambian. Con `parpadeo`, en
 * los ratos tranquilos se cierran los ojos de vez en cuando: a destiempo entre
 * los dos peleones, y siempre igual para el mismo combate. Un parpadeo que no
 * cabe en su rato tranquilo no se pierde: espera al siguiente.
 *
 * `escala` es la velocidad de reproduccion. Los tiempos de la cara se
 * multiplican por ella para que, vistos a x2 o x4, un gesto y un parpadeo
 * duren lo mismo en el reloj de quien mira.
 */
export function pistaDeCaras(
  scene: Scene,
  opciones: { parpadeo: boolean; escala?: number } = { parpadeo: true },
): Map<string, CambioDeCara[]> {
  const pistas = new Map<string, CambioDeCara[]>();
  const e = opciones.escala ?? 1;

  for (const actor of scene.actors) {
    if (actor.appearance === null) continue;

    // Tramos de gesto, en orden y sin solaparse.
    const tramos: { desde: number; hasta: number; cara: Expresion }[] = [];
    for (const beat of scene.beats) {
      for (const move of beat.moves) {
        if (move.kind !== 'face' || move.id !== actor.id) continue;
        const ultimo = tramos.at(-1);
        if (ultimo !== undefined && ultimo.hasta === Infinity) continue;
        if (ultimo !== undefined && ultimo.hasta > beat.at) ultimo.hasta = beat.at;
        if (ultimo !== undefined && beat.at - ultimo.hasta < PUENTE * e) ultimo.hasta = beat.at;
        tramos.push({
          desde: beat.at,
          hasta:
            move.queda === true ? Infinity : beat.at + Math.max(beat.duration, GESTO_MINIMO * e),
          cara: move.cara,
        });
      }
    }

    const cambios: CambioDeCara[] = [];
    let semilla = semillaDe(actor.id) ^ scene.escenario;
    let proximo = (1 + aleatorio(semilla) * ESPERA_VARIA) * e;
    // El rato tranquilo de `desde` a `hasta`, con sus parpadeos. `alFinal`: no
    // viene ningun gesto detras, asi que no hace falta dejarle aire.
    const tranquilo = (desde: number, hasta: number, alFinal: boolean): void => {
      if (!opciones.parpadeo) return;
      const tope = alFinal ? hasta : hasta - AIRE_ANTES_DE_GESTO;
      for (;;) {
        // Pendiente o a punto de tocar al soltar un gesto: sale de el.
        const at = desde > 0 && proximo < desde + PEGADO_AL_GESTO * e ? desde : proximo;
        if (at + PARPADEO * e > tope) return;
        // Si justo ahi se volvia a neutral, ese paso sobra: del gesto a cerrar.
        const previo = cambios.at(-1);
        if (previo !== undefined && previo.at === at && previo.cara === 'neutral') cambios.pop();
        cambios.push({ at, cara: 'parpadeo' }, { at: at + PARPADEO * e, cara: 'neutral' });
        semilla = siguiente(semilla);
        proximo = at + (ESPERA_MIN + aleatorio(semilla) * ESPERA_VARIA) * e;
      }
    };

    let libreDesde = 0;
    for (const [i, tramo] of tramos.entries()) {
      tranquilo(libreDesde, tramo.desde, false);
      cambios.push({ at: tramo.desde, cara: tramo.cara });
      libreDesde = tramo.hasta;
      // Si el siguiente gesto empieza justo al acabar este, se pasa sin volver a neutral.
      if (tramo.hasta !== Infinity && (tramos[i + 1]?.desde ?? Infinity) > tramo.hasta) {
        cambios.push({ at: tramo.hasta, cara: 'neutral' });
      }
    }
    if (libreDesde !== Infinity) tranquilo(libreDesde, scene.duration, true);

    pistas.set(actor.id, cambios);
  }
  return pistas;
}

/** Azar sin `Math.random`: el mismo combate parpadea siempre igual. */
function semillaDe(texto: string): number {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function siguiente(semilla: number): number {
  return (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
}

/** De 0 a 1. */
function aleatorio(semilla: number): number {
  return siguiente(semilla) / 2 ** 32;
}
