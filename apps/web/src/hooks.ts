import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: api.me });

/**
 * Un luchador es mio si esta en /me. Es la unica forma de saberlo en el cliente.
 *
 * Devuelve tambien `sabido`: mientras /me carga NO se sabe de quien es, y dar
 * por hecho que no es tuyo hace que tu propia ficha ensene un instante el boton
 * de desafiarte a ti mismo.
 */
export function useIsMine(slug: string): { mio: boolean; sabido: boolean } {
  const me = useMe();
  return {
    mio: me.data?.brutes.some((b) => b.slug === slug) ?? false,
    sabido: me.data !== undefined,
  };
}

export const useBrute = (slug: string) =>
  useQuery({ queryKey: ['brute', slug], queryFn: () => api.brute(slug) });
