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
  // Solo espacios: ya ha escrito algo, asi que no basta con repetir la regla.
  if (name.length > 0 && limpio.length === 0) {
    return { texto: 'Un nombre de solo espacios no vale.', tipo: 'error', valido: false };
  }
  if (limpio.length === 0) {
    return {
      texto: `De ${NAME_MIN} a ${NAME_MAX} letras. ${IDENTIDAD}`,
      tipo: 'info',
      valido: false,
    };
  }
  const malo = CARACTER_NO_VALIDO.exec(limpio)?.[0];
  if (malo !== undefined) {
    // Se dice cual: con "O'Brien" no se ve a simple vista que sobra el apostrofo.
    return {
      texto: `«${malo}» no vale. Solo letras, números, espacios, guiones y guiones bajos.`,
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
  return {
    texto:
      'Así saldrá. La cara y las estadísticas salen del nombre; el sexo lo eliges tú. Nada de esto se puede cambiar.',
    tipo: 'info',
    valido: true,
  };
}
