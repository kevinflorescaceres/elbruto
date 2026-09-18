import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerRoutes } from './routes.js';
import { registerWeb } from './web.js';

export interface AppOptions {
  /** Peticiones por minuto y por IP. */
  globalLimit?: number;
  /** Creaciones de luchador y denuncias por hora y por IP (PLAN.md §4). */
  createLimit?: number;
}

/**
 * Detras de un proxy (Fly, Railway, Render) todas las peticiones llegan con la
 * IP del proxy: sin esto el rate limit por IP no protege de nada. Creerse la
 * cabecera a ciegas es peor, porque cualquiera la falsifica; por eso se declara
 * cuantos saltos hay. TRUST_PROXY=1 cubre los tres.
 */
function trustProxyFrom(valor: string | undefined): FastifyServerOptions['trustProxy'] {
  if (valor === undefined || valor === '' || valor === 'false') return false;
  if (valor === 'true') return true;
  // Un numero son saltos de confianza; Fastify solo lo admite como funcion.
  if (/^\d+$/.test(valor)) {
    const saltos = Number(valor);
    return (_direccion: string, salto: number) => salto < saltos;
  }
  // Cualquier otra cosa es una IP o un rango (por ejemplo "10.0.0.0/8").
  return valor;
}

export async function buildApp({
  globalLimit = 120,
  createLimit = 5,
}: AppOptions = {}): Promise<FastifyInstance> {
  // Detras de un proxy (Fly, Railway, Render) todas las peticiones llegan con la
  // IP del proxy: sin esto el rate limit por IP no protege de nada. Confiar a
  // ciegas es peor, porque cualquiera falsifica X-Forwarded-For; por eso se
  // declara cuantos saltos hay. TRUST_PROXY=1 cubre los tres.
  const options: FastifyServerOptions = {
    logger: process.env.NODE_ENV !== 'test',
    trustProxy: trustProxyFrom(process.env.TRUST_PROXY),
  };
  const app = Fastify(options);

  await app.register(cookie);
  await app.register(rateLimit, { max: globalLimit, timeWindow: '1 minute' });

  registerRoutes(app, { createLimit });
  // En produccion el mismo servidor sirve el frontend; en desarrollo lo hace Vite.
  await registerWeb(app);
  return app;
}
