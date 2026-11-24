/**
 * Enlaces de recuperacion que el jugador todavia no ha dado por guardados.
 *
 * El servidor lo ensena una sola vez y no hay forma de volver a pedirlo. Antes
 * vivia en el estado de la portada, asi que se perdia al pulsar "Buscar pelea",
 * al recargar o al crear otro peleon. En `sessionStorage` sobrevive a todo eso
 * dentro de la misma pestana y desaparece al cerrarla, que es lo que se quiere:
 * no deja el enlace tirado en el navegador para siempre.
 *
 * Puro salvo el almacen, que se inyecta para poder probarlo.
 */
export interface EnlacePendiente {
  slug: string;
  nombre: string;
  url: string;
}

const CLAVE = 'camorra:enlaces-pendientes';

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** El almacen puede no existir o lanzar (modo privado, cookies bloqueadas). */
function almacenPorDefecto(): Almacen | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function esPendiente(v: unknown): v is EnlacePendiente {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.slug === 'string' && typeof o.nombre === 'string' && typeof o.url === 'string';
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
