/**
 * Sirve el frontend construido y le inyecta metadatos Open Graph.
 *
 * Un SPA no puede ponerlos por su cuenta: los rastreadores de WhatsApp, Twitter
 * o Slack no ejecutan JavaScript, asi que un enlace a un combate llegaria sin
 * titulo ni descripcion. Por eso el HTML sale del servidor ya con las etiquetas.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import { prisma } from './db.js';

const SITE = 'Camorra';

/** Rutas que el frontend sabe pintar. Lo que no encaje es un 404 de verdad. */
const RUTAS = [
  /^\/$/,
  /^\/legal$/,
  /^\/b\/[\w-]+(\/(arena|level-up))?$/,
  /^\/fight\/[\w-]+$/,
  /^\/claim\/[\w-]+$/,
];
const DESCRIPTION_POR_DEFECTO =
  'Pon un nombre y tendras un peleon. Lo demas lo deciden el y la mala suerte.';

/** Los nombres los escribe el jugador: nunca van al HTML sin escapar. */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Meta {
  title: string;
  description: string;
  /** false cuando la ruta tiene forma valida pero el peleon o combate no existe. */
  found: boolean;
}

async function metaFor(pathname: string): Promise<Meta> {
  const combate = /^\/fight\/([\w-]+)$/.exec(pathname);
  if (combate?.[1] !== undefined) {
    const fight = await prisma.fight.findUnique({
      where: { id: combate[1] },
      include: { bruteA: true, bruteB: true },
    });
    if (fight !== null) {
      const gana = fight.winnerId === fight.bruteAId ? fight.bruteA : fight.bruteB;
      const pierde = fight.winnerId === fight.bruteAId ? fight.bruteB : fight.bruteA;
      return {
        title: `${fight.bruteA.name} contra ${fight.bruteB.name}`,
        description: `${gana.name} le gano a ${pierde.name}. Mira como fue.`,
        found: true,
      };
    }
    return { title: SITE, description: DESCRIPTION_POR_DEFECTO, found: false };
  }

  const ficha = /^\/b\/([\w-]+)$/.exec(pathname);
  if (ficha?.[1] !== undefined) {
    const brute = await prisma.brute.findUnique({ where: { slug: ficha[1] } });
    if (brute !== null) {
      return {
        title: brute.name,
        description: `Nivel ${brute.level}, con ${brute.wins} victorias y ${brute.losses} derrotas.`,
        found: true,
      };
    }
    return { title: SITE, description: DESCRIPTION_POR_DEFECTO, found: false };
  }

  return { title: SITE, description: DESCRIPTION_POR_DEFECTO, found: true };
}

function inject(template: string, meta: Meta, url: string): string {
  const title = escape(meta.title === SITE ? SITE : `${meta.title} · ${SITE}`);
  const description = escape(meta.description);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta name="twitter:card" content="summary" />`,
  ].join('\n    ');

  // El <title> del build se sustituye; el resto se anade antes de cerrar la cabecera.
  return template.replace(/<title>.*?<\/title>/s, '').replace('</head>', `  ${tags}\n  </head>`);
}

/**
 * Solo hace algo si existe el build del frontend. En desarrollo no existe y de
 * servir la web se encarga Vite con su proxy.
 */
export async function registerWeb(app: FastifyInstance): Promise<boolean> {
  const dist = resolve(import.meta.dirname, '../../web/dist');
  if (!existsSync(join(dist, 'index.html'))) return false;

  await app.register(fastifyStatic, { root: dist, wildcard: false });
  const template = readFileSync(join(dist, 'index.html'), 'utf8');

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Esa ruta no existe' });
    }
    const pathname = request.url.split('?')[0] ?? '/';
    const base = process.env.PUBLIC_URL ?? `${request.protocol}://${request.hostname}`;
    // El HTML es el mismo (el router pinta su propia pagina), pero el estado no
    // debe mentir: una ruta inventada es un 404 para buscadores y monitores.
    const conocida = RUTAS.some((r) => r.test(pathname));
    const meta = await metaFor(pathname);
    return reply
      .code(conocida && meta.found ? 200 : 404)
      .type('text/html')
      .send(inject(template, meta, `${base}${pathname}`));
  });

  return true;
}
