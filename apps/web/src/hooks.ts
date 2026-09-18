import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: api.me });

/** Un luchador es mio si esta en /me. Es la unica forma de saberlo en el cliente. */
export function useIsMine(slug: string): boolean {
  const me = useMe();
  return me.data?.brutes.some((b) => b.slug === slug) ?? false;
}

export const useBrute = (slug: string) =>
  useQuery({ queryKey: ['brute', slug], queryFn: () => api.brute(slug) });
