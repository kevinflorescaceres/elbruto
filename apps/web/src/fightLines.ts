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

export function describe(event: FightEvent, nameOf: (id: string) => string): string | null {
  switch (event.type) {
    case 'attack':
      return `${nameOf(event.id)} ataca a ${nameOf(event.target)} con ${weaponName(event.weapon)}.`;
    case 'evade':
      return `${nameOf(event.id)} se aparta a tiempo.`;
    case 'block':
      return `${nameOf(event.id)} para el golpe.`;
    case 'counter':
      return `${nameOf(event.id)} responde en el acto.`;
    case 'damage':
      return `${nameOf(event.id)} encaja ${event.amount} y se queda en ${event.hp}.`;
    case 'heal':
      return `${nameOf(event.id)} recupera ${event.amount} y sube a ${event.hp}.`;
    case 'drawWeapon':
      return `${nameOf(event.id)} echa mano de ${weaponName(event.weapon)}.`;
    case 'throwWeapon':
      return `${nameOf(event.id)} le tira ${weaponName(event.weapon)} a ${nameOf(event.target)}.`;
    case 'disarm':
      return `${nameOf(event.id)} desarma a ${nameOf(event.target)}: ${weaponName(event.weapon)} al suelo.`;
    case 'skill':
      return `${nameOf(event.id)} tira de ${getSkill(event.skill).name}.`;
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

  for (const event of replay.log as FightEvent[]) {
    if (event.type === 'spawn') {
      names.set(event.id, event.name);
      hp.set(event.id, event.hp);
      continue;
    }
    if (event.type === 'damage' || event.type === 'heal') hp.set(event.id, event.hp);

    const text = describe(event, (id) => names.get(id) ?? id);
    if (text !== null) {
      steps.push({ text, hpA: hp.get('A') ?? 0, hpB: hp.get('B') ?? 0 });
    }
  }
  return steps;
}
