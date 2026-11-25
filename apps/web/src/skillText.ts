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
    case 'lastStand':
      return 'Una vez por pelea, aguanta de pie con 1 de vida el golpe que lo tumbaría.';
    case 'secondWind':
      return `Por debajo del ${effect.below}% de vida, +${effect.speed} de ${STAT_NAMES.speed ?? 'Brío'} el resto de la pelea.`;
    case 'afterDodge':
      return `Tras esquivar, su siguiente ataque no se puede esquivar y encadena más (+${effect.combo}%).`;
    case 'firstBlow':
      return `El primer golpe que mete en la pelea hace ${effect.multiplier === 2 ? 'el doble' : `×${effect.multiplier}`} de daño.`;
    case 'armor':
      return `Resta ${effect.amount} de daño a cada golpe que encaja, salvo de armas pesadas.`;
    case 'block':
      return `${effect.chance}% de parar un golpe en seco.`;
    case 'counter':
      return `${effect.chance}% de devolver el golpe tras esquivarlo o encajarlo.`;
    case 'heal':
      return `Cura el ${effect.percent}% de la vida al bajar de la mitad, una vez por pelea.`;
    case 'power':
      return `Un golpe con ${effect.multiplier === 2 ? 'el doble' : `×${effect.multiplier}`} de daño, una vez por pelea.`;
    case 'disarm':
      return 'Un tajo a las piernas, una vez por pelea: el rival pierde su siguiente turno y suelta el arma.';
  }
}
