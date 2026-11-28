import type { Gender } from '@camorra/engine';

/** Elige la forma que concuerda con el sexo del peleon. Sin sexo (los antiguos) es hombre. */
export function segun<T>(gender: Gender | undefined, hombre: T, mujer: T): T {
  return gender === 'female' ? mujer : hombre;
}
