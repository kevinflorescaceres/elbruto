import type { Skill } from '@camorra/engine';
import { ESTADISTICAS } from './ui.js';

const STAT_NAMES: Record<string, string> = Object.fromEntries(
  ESTADISTICAS.map(([etiqueta, campo]) => [campo, etiqueta]),
);

/**
 * Que hace una mania, en una frase. Sale del `effect` del motor, asi que si
 * cambia un numero del catalogo, cambia el texto: no hay tabla aparte.
 */
export function describeSkill(skill: Skill): string {
  const effect = skill.effect;
  switch (effect.kind) {
    case 'stat':
      return `+${effect.amount} de ${STAT_NAMES[effect.stat] ?? effect.stat}.`;
    case 'maxHp':
      return `+${effect.amount} de vida.`;
    case 'armor':
      return `Resta ${effect.amount} de daño al primer golpe de cada ataque, salvo armas pesadas.`;
    case 'block':
      return `${effect.chance}% de parar un golpe en seco.`;
    case 'counter':
      return `${effect.chance}% de devolver el golpe tras esquivarlo o encajarlo.`;
    case 'heal':
      return `Cura el ${effect.percent}% de la vida, una vez por pelea.`;
    case 'power':
      return `Un golpe con ${effect.multiplier === 2 ? 'el doble' : `×${effect.multiplier}`} de daño, una vez por pelea.`;
    case 'disarm':
      return 'Le quita el arma al rival, una vez por pelea.';
  }
}
