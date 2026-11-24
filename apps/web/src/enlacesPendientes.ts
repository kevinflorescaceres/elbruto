/**
 * Enlaces de recuperacion que el jugador todavia no ha dado por guardados.
 *
 * El servidor lo ensena una sola vez y no hay forma de volver a pedirlo. Vive en
 * `localStorage` hasta que el jugador dice "Ya lo tengo". Antes vivia en
 * `sessionStorage`, para no dejarlo en el navegador para siempre, pero eso lo
 * perdia al cerrar la pestana, y quien llega por WhatsApp llega en un navegador
 * dentro de la app que se cierra solo. Dejarlo aqui expone poco: quien puede
 * leer este navegador ya tiene el peleon por la cookie.
 *
 * `guardado` se marca al copiarlo o compartirlo: desbloquea las peleas, pero la
 * tarjeta sigue hasta que el jugador la cierra.
 *
 * Puro salvo el almacen, que se inyecta para poder probarlo.
 */
export interface EnlacePendiente {
  slug: string;
  nombre: string;
  url: string;
  /** Ya se copio o se compartio: puede pelear. */
  guardado?: boolean;
}

const CLAVE = 'camorra:enlaces-pendientes';
/** Avisa a las pantallas abiertas de que la lista ha cambiado. */
export const EVENTO_PENDIENTES = 'camorra:pendientes';

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** El almacen puede no existir o lanzar (modo privado, cookies bloqueadas). */
function almacenPorDefecto(): Almacen | null {
  try {
    const local = window.localStorage;
    // Los que se crearon cuando vivian en sessionStorage pasan aqui una vez.
    const viejo = window.sessionStorage.getItem(CLAVE);
    if (viejo !== null) {
      if (local.getItem(CLAVE) === null) local.setItem(CLAVE, viejo);
      window.sessionStorage.removeItem(CLAVE);
    }
    return local;
  } catch {
    return null;
  }
}

function esPendiente(v: unknown): v is EnlacePendiente {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.slug === 'string' &&
    typeof o.nombre === 'string' &&
    typeof o.url === 'string' &&
    (o.guardado === undefined || typeof o.guardado === 'boolean')
  );
}

export function leerPendientes(almacen: Almacen | null = almacenPorDefecto()): EnlacePendiente[] {
  try {
    const crudo = almacen?.getItem(CLAVE);
    if (crudo == null) return [];
    const datos: unknown = JSON.parse(crudo);
    return Array.isArray(datos) ? datos.filter(esPendiente) : [];
  } catch {
    return [];
  }
}

function escribir(lista: EnlacePendiente[], almacen: Almacen | null): void {
  try {
    if (lista.length === 0) almacen?.removeItem(CLAVE);
    else almacen?.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacen, el enlace sigue en pantalla mientras no se salga de ella.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PENDIENTES));
}

/** El mas reciente primero. Si ya estaba (mismo slug), se sustituye. */
export function anadirPendiente(
  enlace: EnlacePendiente,
  almacen: Almacen | null = almacenPorDefecto(),
): EnlacePendiente[] {
  const lista = [enlace, ...leerPendientes(almacen).filter((e) => e.slug !== enlace.slug)];
  escribir(lista, almacen);
  return lista;
}

export function quitarPendiente(
  slug: string,
  almacen: Almacen | null = almacenPorDefecto(),
): EnlacePendiente[] {
  const lista = leerPendientes(almacen).filter((e) => e.slug !== slug);
  escribir(lista, almacen);
  return lista;
}

/** Copiado o compartido: deja pelear, pero no lo quita de la lista. */
export function marcarGuardado(
  slug: string,
  almacen: Almacen | null = almacenPorDefecto(),
): EnlacePendiente[] {
  const lista = leerPendientes(almacen).map((e) =>
    e.slug === slug ? { ...e, guardado: true } : e,
  );
  escribir(lista, almacen);
  return lista;
}

/** Sin pelear hasta guardar el enlace: perder el peleon es lo unico irreparable. */
export function sinGuardar(slug: string, lista: EnlacePendiente[]): boolean {
  return lista.some((e) => e.slug === slug && e.guardado !== true);
}
