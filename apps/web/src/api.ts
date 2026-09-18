/**
 * Cliente de la API. Cada respuesta se valida con los esquemas de
 * `@rufianes/shared`: es el otro extremo del contrato que ya cumple el servidor.
 */
import type { z } from 'zod';
import {
  bruteProfileSchema,
  claimResponse,
  createBruteResponse,
  fightListSchema,
  fightReplaySchema,
  levelUpResponse,
  levelUpSchema,
  meSchema,
  opponentsSchema,
  startFightResponse,
} from '@rufianes/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T extends z.ZodType>(
  schema: T,
  path: string,
  init?: { method: 'POST'; body: unknown },
): Promise<z.infer<T>> {
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    ...(init === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : 'No se ha podido contactar con el servidor';
    throw new ApiError(response.status, message);
  }
  return schema.parse(body);
}

const post = (body: unknown) => ({ method: 'POST', body }) as const;

export const api = {
  me: () => call(meSchema, '/me'),
  createBrute: (name: string) => call(createBruteResponse, '/brutes', post({ name })),
  claim: (token: string) => call(claimResponse, '/claim', post({ token })),

  brute: (slug: string) => call(bruteProfileSchema, `/brutes/${slug}`),
  fights: (slug: string) => call(fightListSchema, `/brutes/${slug}/fights`),
  opponents: (slug: string) => call(opponentsSchema, `/brutes/${slug}/opponents`),
  startFight: (slug: string, opponentSlug: string) =>
    call(startFightResponse, `/brutes/${slug}/fights`, post({ opponentSlug })),

  levelUp: (slug: string) => call(levelUpSchema, `/brutes/${slug}/level-up`),
  chooseLevelUp: (slug: string, choiceIndex: 0 | 1) =>
    call(levelUpResponse, `/brutes/${slug}/level-up`, post({ choiceIndex })),

  fight: (id: string) => call(fightReplaySchema, `/fights/${id}`),
  report: (slug: string, reason: string) =>
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, reason }),
    }).then((r) => {
      if (!r.ok) throw new ApiError(r.status, 'No se ha podido enviar la denuncia');
    }),
};
