/**
 * Identidad sin login (PLAN.md §4). El navegador guarda un token en una cookie
 * httpOnly; en la BD solo vive su SHA-256.
 */
import { createHash, randomBytes } from 'node:crypto';
// Necesario para que request.cookies y reply.setCookie existan en los tipos.
import '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './db.js';

export const COOKIE = 'rufian';

export const newToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** Guardian de la cookie, si existe. No crea nada: las paginas publicas no deben. */
export async function currentKeeperId(request: FastifyRequest): Promise<string | null> {
  const token = request.cookies[COOKIE];
  if (token === undefined) return null;
  const keeper = await prisma.keeper.findUnique({ where: { tokenHash: hashToken(token) } });
  return keeper?.id ?? null;
}

/** Guardian de la cookie, creandolo si hace falta. Solo en rutas que lo necesitan. */
export async function requireKeeperId(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<string> {
  const existing = await currentKeeperId(request);
  if (existing !== null) return existing;

  const token = newToken();
  const keeper = await prisma.keeper.create({ data: { tokenHash: hashToken(token) } });
  reply.setCookie(COOKIE, token, cookieOptions);
  return keeper.id;
}
