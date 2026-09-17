/**
 * Endpoints de PLAN.md §8. Aqui no hay ninguna regla de juego: todo lo que
 * decide viene de `@rufianes/engine`.
 */
import { randomInt } from 'node:crypto';
import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify';
import {
  addXp,
  applyLevelUpOption,
  createBrute,
  rollLevelUpOptions,
  simulate,
  type LevelUpOption,
} from '@rufianes/engine';
import {
  claimBody,
  createBruteBody,
  levelUpBody,
  levelUpOptionSchema,
  reportBody,
  startFightBody,
} from '@rufianes/shared';
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

const bruteInclude = { levelUpChoice: true } as const;

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
      return reply.code(400).send({ error: z.prettifyError(error) });
    }
    app.log.error(error);
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.code(status).send({ error: status === 500 ? 'Error interno' : error.message });
  });

  app.get('/api/health', () => ({ ok: true as const, engineVersion: 1 }));

  // --- Identidad ---

  app.get('/api/me', async (request, reply) => {
    const keeperId = await requireKeeperId(request, reply);
    const brutes = await prisma.brute.findMany({
      where: { keeperId },
      include: bruteInclude,
      orderBy: { createdAt: 'asc' },
    });
    return { brutes: brutes.map(rowToProfile) };
  });

  const strictLimit = { config: { rateLimit: { max: createLimit, timeWindow: '1 hour' } } };

  app.post('/api/brutes', strictLimit, async (request, reply) => {
    const { name } = createBruteBody.parse(request.body);
    const check = checkName(name);
    if (!check.ok) throw new HttpError(400, check.reason);

    const taken = await prisma.brute.findUnique({ where: { slug: check.slug } });
    if (taken !== null) throw new HttpError(409, 'Ese nombre ya esta cogido');

    const keeperId = await requireKeeperId(request, reply);
    const brute = createBrute(name.trim());
    const claimToken = newToken();

    const row = await prisma.brute.create({
      data: {
        name: brute.name,
        slug: brute.slug,
        keeperId,
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
    return rowToProfile(await loadBrute(slug));
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
    const opponents = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Brute"
      WHERE level BETWEEN ${row.level - 1} AND ${row.level + 1}
        AND id <> ${row.id}
        AND ("keeperId" IS NULL OR "keeperId" <> ${row.keeperId ?? ''})
      ORDER BY random() LIMIT 6`;

    const rows = await prisma.brute.findMany({
      where: { id: { in: opponents.map((o) => o.id) } },
      include: bruteInclude,
    });
    return { opponents: rows.map(rowToProfile) };
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
      if (fightsLeftToday(me) <= 0) throw new HttpError(429, 'No te quedan peleas hoy');

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
