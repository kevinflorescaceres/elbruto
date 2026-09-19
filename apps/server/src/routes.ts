/**
 * Endpoints de PLAN.md §8. Aqui no hay ninguna regla de juego: todo lo que
 * decide viene de `@camorra/engine`.
 */
import { randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify';
import {
  addXp,
  applyLevelUpOption,
  createBrute,
  ENGINE_VERSION,
  rollLevelUpOptions,
  simulate,
  type LevelUpOption,
} from '@camorra/engine';
import {
  claimBody,
  createBruteBody,
  levelUpBody,
  levelUpOptionSchema,
  reportBody,
  startFightBody,
} from '@camorra/shared';
import { z } from 'zod';
import {
  asJson,
  fightsLeftToday,
  gameDay,
  prisma,
  rowToProfile,
  snapshotToProfile,
  toEngineBrute,
} from './db.js';
import { currentKeeperId, hashToken, newToken, requireKeeperId } from './keeper.js';
import { checkName } from './names.js';

const slugParams = z.object({ slug: z.string().min(1) });
const idParams = z.object({ id: z.string().min(1) });

const bruteInclude = {
  levelUpChoice: true,
  // El recuento de pupilos decide cuantas peleas diarias tiene.
  _count: { select: { pupils: true } },
  master: { select: { name: true, slug: true } },
} as const;

/** Primero el nivel, luego las victorias, y a igualdad el mas veterano. */
const ORDEN_RANKING = [
  { level: 'desc' },
  { wins: 'desc' },
  { createdAt: 'asc' },
] satisfies Prisma.BruteOrderByWithRelationInput[];

/**
 * Cuantos van por delante, mas uno. Es una consulta extra por ficha vista.
 * ponytail: cuenta sobre el indice (isBot, level); si algun dia hay muchos
 * jugadores, guardar el puesto y recalcularlo al terminar un combate.
 */
async function puestoDe(row: { level: number; wins: number }): Promise<number> {
  const porDelante = await prisma.brute.count({
    where: {
      isBot: false,
      OR: [{ level: { gt: row.level } }, { level: row.level, wins: { gt: row.wins } }],
    },
  });
  return porDelante + 1;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function loadBrute(slug: string) {
  const row = await prisma.brute.findUnique({ where: { slug }, include: bruteInclude });
  if (row === null) throw new HttpError(404, 'Luchador no encontrado');
  return row;
}

/** Carga el luchador y exige que la cookie sea la de su duenio. */
async function loadOwnBrute(request: FastifyRequest, slug: string) {
  const row = await loadBrute(slug);
  const keeperId = await currentKeeperId(request);
  if (keeperId === null || row.keeperId !== keeperId) {
    throw new HttpError(403, 'Este luchador no es tuyo');
  }
  return row;
}

const parseOptions = (value: unknown): [LevelUpOption, LevelUpOption] =>
  z.tuple([levelUpOptionSchema, levelUpOptionSchema]).parse(value);

export function registerRoutes(
  app: FastifyInstance,
  { createLimit }: { createLimit: number },
): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.message });
    if (error instanceof z.ZodError) {
      // El mensaje del primer fallo, no el volcado de Zod: esto se ensena al jugador.
      return reply.code(400).send({ error: error.issues[0]?.message ?? 'Datos no validos' });
    }
    app.log.error(error);
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? 'Error interno' : error.message });
  });

  app.get('/api/health', () => ({ ok: true as const, engineVersion: ENGINE_VERSION }));

  // --- Identidad ---

  /**
   * NO crea guardian. PLAN.md §8 decia que lo creara, pero crear identidad como
   * efecto de una lectura es una carrera: React monta dos veces, salen dos GET
   * sin cookie a la vez, se crean dos guardianes y el navegador se queda con una
   * sola cookie. El peleon acaba colgando del guardian que no es.
   *
   * La identidad se crea en la primera ESCRITURA, que es cuando hace falta.
   */
  app.get('/api/me', async (request) => {
    const keeperId = await currentKeeperId(request);
    if (keeperId === null) return { brutes: [] };

    const brutes = await prisma.brute.findMany({
      where: { keeperId },
      include: bruteInclude,
      orderBy: { createdAt: 'asc' },
    });
    return { brutes: brutes.map((row) => rowToProfile(row)) };
  });

  const strictLimit = { config: { rateLimit: { max: createLimit, timeWindow: '1 hour' } } };

  app.post('/api/brutes', strictLimit, async (request, reply) => {
    const { name, masterSlug } = createBruteBody.parse(request.body);
    const check = checkName(name);
    if (!check.ok) throw new HttpError(400, check.reason);

    const taken = await prisma.brute.findUnique({ where: { slug: check.slug } });
    if (taken !== null) throw new HttpError(409, 'Ese nombre ya esta cogido');

    const keeperId = await requireKeeperId(request, reply);
    const brute = createBrute(name.trim());
    const claimToken = newToken();

    // Reclutarte a ti mismo no cuenta: el maestro tiene que ser de otro.
    const maestro =
      masterSlug === undefined
        ? null
        : await prisma.brute.findUnique({ where: { slug: masterSlug } });
    const masterId =
      maestro !== null && maestro.keeperId !== keeperId && !maestro.isBot ? maestro.id : null;

    const row = await prisma.brute.create({
      data: {
        name: brute.name,
        slug: brute.slug,
        keeperId,
        masterId,
        claimTokenHash: hashToken(claimToken),
        level: brute.level,
        xp: brute.xp,
        endurance: brute.endurance,
        strength: brute.strength,
        agility: brute.agility,
        speed: brute.speed,
        weapons: brute.weapons,
        skills: brute.skills,
        pets: brute.pets,
        appearance: asJson(brute.appearance),
      },
      include: bruteInclude,
    });

    // Se muestra una sola vez: no hay endpoint para volver a pedirlo.
    return reply.code(201).send({
      brute: rowToProfile(row),
      claimUrl: `/claim/${claimToken}`,
    });
  });

  app.post('/api/claim', async (request, reply) => {
    const { token } = claimBody.parse(request.body);
    const row = await prisma.brute.findUnique({
      where: { claimTokenHash: hashToken(token) },
      include: bruteInclude,
    });
    if (row === null) throw new HttpError(404, 'Ese enlace no vale');

    const keeperId = await requireKeeperId(request, reply);
    const updated = await prisma.brute.update({
      where: { id: row.id },
      data: { keeperId },
      include: bruteInclude,
    });
    return { brute: rowToProfile(updated) };
  });

  // --- Consulta publica ---

  app.get('/api/brutes/:slug', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const row = await loadBrute(slug);
    // Los bots no compiten en el ranking, asi que no tienen puesto.
    return rowToProfile(row, row.isBot ? {} : { rank: await puestoDe(row) });
  });

  app.get('/api/ranking', async (request) => {
    const { limit } = z
      .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
      .parse(request.query);

    const [brutes, total] = await Promise.all([
      prisma.brute.findMany({
        where: { isBot: false },
        orderBy: ORDEN_RANKING,
        take: limit,
      }),
      prisma.brute.count({ where: { isBot: false } }),
    ]);

    return {
      brutes: brutes.map((row, i) => ({
        rank: i + 1,
        name: row.name,
        slug: row.slug,
        level: row.level,
        wins: row.wins,
        losses: row.losses,
      })),
      total,
    };
  });

  app.get('/api/brutes/:slug/fights', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const { cursor, limit } = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(request.query);

    const row = await loadBrute(slug);
    const fights = await prisma.fight.findMany({
      where: { OR: [{ bruteAId: row.id }, { bruteBId: row.id }] },
      include: { bruteA: true, bruteB: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    const page = fights.slice(0, limit);
    return {
      fights: page.map((fight) => {
        const opponent = fight.bruteAId === row.id ? fight.bruteB : fight.bruteA;
        return {
          id: fight.id,
          createdAt: fight.createdAt.toISOString(),
          opponent: { name: opponent.name, slug: opponent.slug, level: opponent.level },
          won: fight.winnerId === row.id,
        };
      }),
      nextCursor: fights.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  });

  app.get('/api/fights/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const fight = await prisma.fight.findUnique({ where: { id } });
    if (fight === null) throw new HttpError(404, 'Combate no encontrado');

    return {
      id: fight.id,
      createdAt: fight.createdAt.toISOString(),
      seed: fight.seed,
      engineVersion: fight.engineVersion,
      winner: fight.winnerId === fight.bruteAId ? 'A' : 'B',
      snapshotA: snapshotToProfile(toEngineBrute(fight.snapshotA as never)),
      snapshotB: snapshotToProfile(toEngineBrute(fight.snapshotB as never)),
      log: fight.log,
    };
  });

  // --- Acciones del duenio ---

  app.get('/api/brutes/:slug/opponents', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const row = await loadOwnBrute(request, slug);

    // ponytail: ORDER BY random() escanea los candidatos; con muchos luchadores
    // por nivel, cambiar a un salto por offset aleatorio.
    // Primero la gente, luego bots para rellenar: el juego es pelear con otros
    // jugadores y los bots estan para que nunca falte rival.
    const opponents = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Brute"
      WHERE level BETWEEN ${row.level - 1} AND ${row.level + 1}
        AND id <> ${row.id}
        AND ("keeperId" IS NULL OR "keeperId" <> ${row.keeperId ?? ''})
      ORDER BY "isBot" ASC, random() LIMIT 6`;

    const rows = await prisma.brute.findMany({
      where: { id: { in: opponents.map((o) => o.id) } },
      include: bruteInclude,
    });
    // findMany no conserva el orden del IN, y ese orden es el que pone delante
    // a los jugadores.
    const porId = new Map(rows.map((r) => [r.id, r]));
    return {
      opponents: opponents
        .map((o) => porId.get(o.id))
        .filter((r) => r !== undefined)
        .map((row) => rowToProfile(row)),
    };
  });

  app.post('/api/brutes/:slug/fights', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const { opponentSlug } = startFightBody.parse(request.body);
    await loadOwnBrute(request, slug);

    // Todo dentro de la transaccion: los limites se comprueban sobre lo que se escribe.
    return prisma.$transaction(async (tx) => {
      const me = await tx.brute.findUnique({ where: { slug }, include: bruteInclude });
      if (me === null) throw new HttpError(404, 'Luchador no encontrado');
      if (me.levelUpChoice !== null) throw new HttpError(409, 'Tienes una mejora pendiente');
      if (fightsLeftToday(me, me._count.pupils) <= 0) {
        throw new HttpError(429, 'No te quedan peleas hoy');
      }

      const rival = await tx.brute.findUnique({ where: { slug: opponentSlug } });
      if (rival === null) throw new HttpError(404, 'Ese oponente no existe');
      if (rival.id === me.id) throw new HttpError(400, 'No puedes pelear contigo mismo');
      if (Math.abs(rival.level - me.level) > 1) {
        throw new HttpError(400, 'Ese oponente no es de tu nivel');
      }

      const snapshotA = toEngineBrute(me);
      const snapshotB = toEngineBrute(rival);
      const seed = randomInt(0, 2 ** 31 - 1);
      const result = simulate(snapshotA, snapshotB, seed);
      const won = result.winner === 'A';

      const fight = await tx.fight.create({
        data: {
          bruteAId: me.id,
          bruteBId: rival.id,
          winnerId: won ? me.id : rival.id,
          seed,
          engineVersion: result.engineVersion,
          snapshotA: asJson(snapshotA),
          snapshotB: asJson(snapshotB),
          log: asJson(result.log),
        },
      });

      // XP solo para quien ataca; el record se apunta a los dos. Si el defensor
      // ganase XP acabaria con mejoras pendientes que bloquean sus propias peleas.
      const xpGained = won ? 2 : 1;
      const grown = addXp(snapshotA, xpGained);
      const today = gameDay();

      await tx.brute.update({
        where: { id: me.id },
        data: {
          xp: grown.brute.xp,
          level: grown.brute.level,
          wins: won ? { increment: 1 } : undefined,
          losses: won ? undefined : { increment: 1 },
          fightsToday: me.lastFightDay === today ? { increment: 1 } : 1,
          lastFightDay: today,
        },
      });
      await tx.brute.update({
        where: { id: rival.id },
        data: won ? { losses: { increment: 1 } } : { wins: { increment: 1 } },
      });

      if (grown.levelsGained > 0) {
        // xpForLevel(n) >= 5 y una pelea da como mucho 2 XP: nunca son 2 niveles.
        await tx.levelUpChoice.create({
          data: {
            bruteId: me.id,
            level: grown.brute.level,
            options: asJson(rollLevelUpOptions(grown.brute)),
          },
        });
      }

      return {
        fightId: fight.id,
        won,
        xpGained,
        leveledUp: grown.levelsGained > 0,
      };
    });
  });

  app.get('/api/brutes/:slug/level-up', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const row = await loadOwnBrute(request, slug);
    if (row.levelUpChoice === null) throw new HttpError(404, 'No tienes ninguna mejora pendiente');
    return { level: row.levelUpChoice.level, options: parseOptions(row.levelUpChoice.options) };
  });

  app.post('/api/brutes/:slug/level-up', async (request) => {
    const { slug } = slugParams.parse(request.params);
    const { choiceIndex } = levelUpBody.parse(request.body);
    await loadOwnBrute(request, slug);

    return prisma.$transaction(async (tx) => {
      const row = await tx.brute.findUnique({ where: { slug }, include: bruteInclude });
      if (row?.levelUpChoice == null)
        throw new HttpError(404, 'No tienes ninguna mejora pendiente');

      const chosen = parseOptions(row.levelUpChoice.options)[choiceIndex];
      const updated = applyLevelUpOption(toEngineBrute(row), chosen);

      await tx.levelUpChoice.delete({ where: { id: row.levelUpChoice.id } });
      const saved = await tx.brute.update({
        where: { id: row.id },
        data: {
          endurance: updated.endurance,
          strength: updated.strength,
          agility: updated.agility,
          speed: updated.speed,
          weapons: updated.weapons,
          skills: updated.skills,
          pets: updated.pets,
        },
        include: bruteInclude,
      });
      return { brute: rowToProfile(saved) };
    });
  });

  // --- Moderacion (PLAN.md §11) ---

  app.post('/api/reports', strictLimit, async (request, reply) => {
    const { slug, reason } = reportBody.parse(request.body);
    const row = await loadBrute(slug);
    await prisma.report.create({ data: { bruteId: row.id, reason, ip: request.ip } });
    return reply.code(201).send({ ok: true });
  });
}
