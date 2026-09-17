/**
 * Invariantes del log de combate. Vive en el motor (no solo en los tests) porque
 * es la definicion de "log valido" que el cliente da por supuesta al animar.
 */
import type { FightEvent, FightResult } from './types.js';

/** Ids de combatiente que aparecen en un evento: [actor, objetivo?]. */
function refs(event: FightEvent): { actor?: string; target?: string } {
  switch (event.type) {
    case 'start':
    case 'end':
      return {};
    case 'spawn':
      return {};
    case 'evade':
    case 'block':
    case 'death':
    case 'turn':
    case 'heal':
    case 'damage':
    case 'skill':
    case 'drawWeapon':
      return { actor: event.id };
    default:
      return { actor: event.id, target: event.target };
  }
}

/** Devuelve la lista de violaciones. Vacia = log valido. */
export function validateLog(result: FightResult): string[] {
  const errors: string[] = [];
  const hp = new Map<string, number>();
  const maxHp = new Map<string, number>();
  const dead = new Set<string>();
  const log = result.log;

  if (log[0]?.type !== 'start') errors.push('el log no empieza con start');
  if (log.at(-1)?.type !== 'end') errors.push('el log no termina con end');

  for (let i = 0; i < log.length; i++) {
    const event = log[i];
    if (event === undefined) continue;

    if (event.type === 'spawn') {
      if (hp.has(event.id)) errors.push(`spawn duplicado: ${event.id}`);
      hp.set(event.id, event.hp);
      maxHp.set(event.id, event.maxHp);
      continue;
    }

    const { actor, target } = refs(event);
    for (const id of [actor, target]) {
      if (id === undefined) continue;
      if (!hp.has(id)) errors.push(`evento ${event.type} sobre un id sin spawn: ${id}`);
      // El propio evento que mata a alguien sigue siendo valido.
      if (dead.has(id)) errors.push(`evento ${event.type} sobre un combatiente muerto: ${id}`);
    }

    const limit = maxHp.get(actor ?? '') ?? 0;
    const before = hp.get(actor ?? '') ?? 0;

    switch (event.type) {
      case 'damage': {
        if (event.amount <= 0) errors.push(`dano no positivo: ${event.amount}`);
        const expected = Math.max(0, before - event.amount);
        if (event.hp !== expected)
          errors.push(`hp incoherente en damage: ${event.hp} != ${expected}`);
        if (event.hp < 0 || event.hp > limit)
          errors.push(`hp fuera de rango: ${event.hp}/${limit}`);
        hp.set(event.id, event.hp);
        if (event.hp === 0 && log[i + 1]?.type !== 'death') {
          errors.push(`muerte sin evento death: ${event.id}`);
        }
        break;
      }
      case 'heal': {
        if (event.amount <= 0) errors.push(`curacion no positiva: ${event.amount}`);
        const expected = Math.min(limit, before + event.amount);
        if (event.hp !== expected)
          errors.push(`hp incoherente en heal: ${event.hp} != ${expected}`);
        hp.set(event.id, event.hp);
        break;
      }
      case 'death': {
        if (before !== 0) errors.push(`death con hp ${before}: ${event.id}`);
        dead.add(event.id);
        break;
      }
      default:
        break;
    }
  }

  const loser = result.winner === 'A' ? 'B' : 'A';
  const share = (id: string): number => (hp.get(id) ?? 0) / (maxHp.get(id) || 1);
  if ((hp.get(result.winner) ?? 0) === 0) errors.push('el ganador esta muerto');
  if ((hp.get(loser) ?? 0) > 0 && share(result.winner) < share(loser)) {
    errors.push('por tope de turnos gana quien tiene menor porcentaje de vida');
  }

  return errors;
}
