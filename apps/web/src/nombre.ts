/**
 * El texto bajo el campo del nombre en la portada. Antes de escribir explica la
 * regla; mientras se escribe, dice lo que falta. Puro y sin React, para poder
 * probarlo. El servidor sigue validando: esto solo avisa antes de enviar.
 */
import { slugify } from '@camorra/engine';
import { NAME_MAX, NAME_MIN } from '@camorra/shared';

/** Lo que admite el nombre, sin la longitud: esa se cuenta aparte. */
const CARACTER_NO_VALIDO = /[^\p{L}\p{N} _-]/u;

export interface AyudaNombre {
  texto: string;
  tipo: 'info' | 'error';
  valido: boolean;
}

const IDENTIDAD = 'De él salen su cara y sus estadísticas, y no se puede cambiar.';

export function ayudaNombre(name: string): AyudaNombre {
  const limpio = name.trim();
  if (limpio.length === 0) {
    return {
      texto: `De ${NAME_MIN} a ${NAME_MAX} letras. ${IDENTIDAD}`,
      tipo: 'info',
      valido: false,
    };
  }
  if (CARACTER_NO_VALIDO.test(limpio)) {
    return {
      texto: 'Solo letras, números, espacios, guiones y guiones bajos.',
      tipo: 'error',
      valido: false,
    };
  }
  // Se cuenta sobre el slug porque es lo que mide el servidor (names.ts).
  const faltan = NAME_MIN - slugify(limpio).length;
  if (faltan > 0) {
    return {
      texto: faltan === 1 ? 'Te falta 1 letra.' : `Te faltan ${faltan} letras.`,
      tipo: 'info',
      valido: false,
    };
  }
  return { texto: IDENTIDAD, tipo: 'info', valido: true };
}
