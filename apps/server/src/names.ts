/**
 * Validacion de nombres de luchador (PLAN.md §8 y §11).
 *
 * La lista de bloqueo es deliberadamente corta: sirve para atajar lo evidente,
 * no para moderar. Lo demas se atiende con la denuncia (`POST /api/reports`) y
 * el comando `pnpm admin`. Para ampliarla basta anadir lineas aqui o rellenar
 * BLOCKED_NAMES_EXTRA con una lista separada por comas.
 */
import { slugify } from '@rufianes/engine';
import { NAME_HINT, NAME_MIN } from '@rufianes/shared';

const BASE_BLOCKED = [
  'puta',
  'puto',
  'zorra',
  'maricon',
  'mierda',
  'joder',
  'cono',
  'polla',
  'nazi',
  'hitler',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'rape',
  'admin',
  'moderador',
];

const extra = (process.env.BLOCKED_NAMES_EXTRA ?? '')
  .split(',')
  .map((w) => slugify(w))
  .filter((w) => w.length > 0);

const blocked = [...BASE_BLOCKED.map(slugify), ...extra];

export type NameCheck = { ok: true; slug: string } | { ok: false; reason: string };

/** Comprueba forma y contenido. El slug es la identidad canonica. */
export function checkName(name: string): NameCheck {
  const slug = slugify(name);
  if (slug.length < NAME_MIN) return { ok: false, reason: NAME_HINT };
  // El slug ya viene sin acentos ni mayusculas: esquivarlo con "PuTa" no funciona.
  const hit = blocked.find((word) => slug.includes(word));
  if (hit !== undefined) return { ok: false, reason: 'Ese nombre no esta permitido' };
  return { ok: true, slug };
}
