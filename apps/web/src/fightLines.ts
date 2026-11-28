/**
 * Del log del motor a lineas de texto. Puro y sin React: la fase 4 reutilizara
 * este mismo recorrido para construir la linea de tiempo de PixiJS.
 */
import { getSkill, getWeapon, type FightEvent } from '@camorra/engine';
import type { FightReplay } from '@camorra/shared';

export interface Step {
  text: string;
  hpA: number;
  hpB: number;
}

/** Las mascotas pelean con un arma sintetica `pet:<id>` que no esta en el catalogo. */
export const weaponName = (id: string): string =>
  id.startsWith('pet:') ? 'los dientes' : getWeapon(id).name;

export interface Contexto {
  /**
   * El evento anterior, sin contar el acercamiento (`move`). El motor cuenta
   * algunas acciones en dos eventos y, sin esto, el texto las decia dos veces.
   */
  previo?: FightEvent | null;
  /**
   * Para la linea bajo el lienzo: al rival no se le nombra, que se ve a quien
   * se pega. A un bicho si, porque podria ser cualquiera de los de la arena.
   */
  corto?: boolean;
}

/** Solo los dos peleones se llaman `A` y `B`; los bichos son `A-pet-0`... */
const esPeleon = (id: string): boolean => id === 'A' || id === 'B';

/** El evento que hace de `previo` para el siguiente: todos menos acercarse. */
export const cuentaComoPrevio = (event: FightEvent): boolean => event.type !== 'move';

export function describe(
  event: FightEvent,
  nameOf: (id: string) => string,
  { previo = null, corto = false }: Contexto = {},
): string | null {
  // " a Pepa", o nada si el rival se sobreentiende.
  const a = (id: string): string => (corto && esPeleon(id) ? '' : ` a ${nameOf(id)}`);

  switch (event.type) {
    case 'attack':
      // Lanzar es `throwWeapon` y luego el `attack` con esa misma arma.
      if (previo?.type === 'throwWeapon' && previo.id === event.id) return null;
      // Contraatacar es `counter` y luego su `attack`: se cuenta con el golpe.
      if (previo?.type === 'counter' && previo.id === event.id) {
        return `${nameOf(event.id)} responde${a(event.target)} con ${weaponName(event.weapon)}.`;
      }
      return `${nameOf(event.id)} ataca${a(event.target)} con ${weaponName(event.weapon)}.`;
    case 'evade':
      return `${nameOf(event.id)} se aparta a tiempo.`;
    case 'block':
      return `${nameOf(event.id)} para el golpe.`;
    // Lo dice el `attack` que viene detras, que ya sabe con que responde.
    case 'counter':
      return null;
    case 'damage':
      return `${nameOf(event.id)} encaja ${event.amount} y se queda en ${event.hp}.`;
    case 'heal':
      return `${nameOf(event.id)} recupera ${event.amount} y sube a ${event.hp}.`;
    case 'drawWeapon':
      return `${nameOf(event.id)} echa mano de ${weaponName(event.weapon)}.`;
    case 'throwWeapon':
      return corto && esPeleon(event.target)
        ? `${nameOf(event.id)} lanza ${weaponName(event.weapon)}.`
        : `${nameOf(event.id)} le tira ${weaponName(event.weapon)} a ${nameOf(event.target)}.`;
    case 'disarm':
      return corto && esPeleon(event.target)
        ? `${nameOf(event.id)} le quita ${weaponName(event.weapon)}.`
        : `${nameOf(event.id)} desarma a ${nameOf(event.target)}: ${weaponName(event.weapon)} al suelo.`;
    case 'weaponLost':
      // "Se queda sin" concuerda con Cascote y con Cuchillos de Tiro por igual.
      if (event.reason === 'agotada') {
        return `${nameOf(event.id)} se queda sin ${weaponName(event.weapon)}.`;
      }
      return corto
        ? `${weaponName(event.weapon)} se hace añicos.`
        : `A ${nameOf(event.id)} se le rompe ${weaponName(event.weapon)}.`;
    case 'skill': {
      // Las pasivas de disparo no se "usan": pasan. Cada una con su frase.
      const skill = getSkill(event.skill);
      switch (skill.effect.kind) {
        case 'lastStand':
          return `${nameOf(event.id)} aguanta de pie con 1 de vida.`;
        case 'secondWind':
          return `${nameOf(event.id)} toma resuello y se acelera.`;
        case 'afterDodge':
          return `${nameOf(event.id)} sale del quiebro y entra seguro.`;
        case 'firstBlow':
          return `${nameOf(event.id)} mete el primer golpe con todo el brazo.`;
        case 'disarm':
          return `${nameOf(event.id)} le tira un tajo a las piernas.`;
        default:
          return `${nameOf(event.id)} tira de ${skill.name}.`;
      }
    }
    case 'death':
      return `${nameOf(event.id)} se desploma.`;
    case 'end':
      return `Se acabó en ${event.turns} turnos.`;
    // start, spawn, turn, move y hit son estructurales: el cliente los usa para
    // animar, pero como texto solo serian ruido.
    default:
      return null;
  }
}

/** Recorre el log una vez y deja cada linea con la vida que habia en ese momento. */
export function buildSteps(replay: Pick<FightReplay, 'log'>): Step[] {
  const names = new Map<string, string>();
  const hp = new Map<string, number>();
  const steps: Step[] = [];
  let previo: FightEvent | null = null;

  for (const event of replay.log as FightEvent[]) {
    if (event.type === 'spawn') {
      names.set(event.id, event.name);
      hp.set(event.id, event.hp);
      continue;
    }
    if (event.type === 'damage' || event.type === 'heal') hp.set(event.id, event.hp);

    const text = describe(event, (id) => names.get(id) ?? id, { previo });
    if (cuentaComoPrevio(event)) previo = event;
    if (text !== null) {
      steps.push({ text, hpA: hp.get('A') ?? 0, hpB: hp.get('B') ?? 0 });
    }
  }
  return steps;
}
