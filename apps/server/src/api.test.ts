/**
 * Criterio de "listo" de la Fase 2: crear un luchador, pelear, subir de nivel y
 * ver el combate, solo con llamadas HTTP.
 */
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { prisma } from './db.js';

let app: FastifyInstance;

/** Un "navegador": conserva su cookie entre peticiones. */
class Browser {
  private cookie: string | undefined;

  async call(
    method: 'GET' | 'POST',
    url: string,
    payload?: object,
  ): Promise<{ status: number; body: any }> {
    const options: InjectOptions = {
      method,
      url,
      headers: this.cookie === undefined ? {} : { cookie: this.cookie },
    };
    if (payload !== undefined) options.payload = payload;

    const res = await app.inject(options);
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (raw !== undefined) this.cookie = raw.split(';')[0];
    return { status: res.statusCode, body: res.body === '' ? null : res.json() };
  }
}

const unique = (prefix: string): string => `${prefix}${Math.random().toString(36).slice(2, 8)}`;

/** Crea un luchador en su propio navegador. */
async function newFighter(
  prefix: string,
): Promise<{ browser: Browser; slug: string; claim: string }> {
  const browser = new Browser();
  const res = await browser.call('POST', '/api/brutes', { name: unique(prefix) });
  expect(res.status).toBe(201);
  return { browser, slug: res.body.brute.slug, claim: res.body.claimUrl.split('/').pop() };
}

beforeAll(async () => {
  // Los tests comparten IP: los limites reales se prueban aparte, mas abajo.
  app = await buildApp({ globalLimit: 100_000, createLimit: 100_000 });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Report", "Fight", "LevelUpChoice", "Brute", "Keeper" RESTART IDENTITY CASCADE',
  );
});

describe('creacion de luchadores', () => {
  it('crea, devuelve enlace de recuperacion y lo lista en /me', async () => {
    const { browser, slug } = await newFighter('rufian');

    const me = await browser.call('GET', '/api/me');
    expect(me.body.brutes).toHaveLength(1);
    expect(me.body.brutes[0].slug).toBe(slug);
    expect(me.body.brutes[0].level).toBe(1);
    expect(me.body.brutes[0].fightsLeftToday).toBe(6);
  });

  it('rechaza nombres repetidos, mal formados y bloqueados', async () => {
    const browser = new Browser();
    await browser.call('POST', '/api/brutes', { name: 'Chirlo Tuerto' });

    expect((await browser.call('POST', '/api/brutes', { name: 'chirlo tuerto' })).status).toBe(409);
    expect((await browser.call('POST', '/api/brutes', { name: 'ab' })).status).toBe(400);
    expect((await browser.call('POST', '/api/brutes', { name: 'el puta amo' })).status).toBe(400);
  });

  it('el perfil es publico pero pelear no lo es', async () => {
    const { slug } = await newFighter('publico');
    const rival = await newFighter('rival');

    const otro = new Browser();
    expect((await otro.call('GET', `/api/brutes/${slug}`)).status).toBe(200);
    expect((await otro.call('GET', `/api/brutes/${slug}/opponents`)).status).toBe(403);
    expect(
      (await otro.call('POST', `/api/brutes/${slug}/fights`, { opponentSlug: rival.slug })).status,
    ).toBe(403);
  });

  it('el enlace de recuperacion mueve el luchador a otro navegador', async () => {
    const { claim, slug } = await newFighter('perdido');

    const otro = new Browser();
    const res = await otro.call('POST', '/api/claim', { token: claim });
    expect(res.status).toBe(200);
    expect(res.body.brute.slug).toBe(slug);
    expect((await otro.call('GET', '/api/me')).body.brutes).toHaveLength(1);
  });
});

describe('ciclo completo', () => {
  it('pelea, gana XP, sube de nivel, elige mejora y ve la repeticion', async () => {
    const mine = await newFighter('mio');
    const theirs = await newFighter('suyo');

    const opponents = await mine.browser.call('GET', `/api/brutes/${mine.slug}/opponents`);
    expect(opponents.status).toBe(200);
    expect(opponents.body.opponents.map((o: any) => o.slug)).toContain(theirs.slug);

    // 3 peleas dan 3-6 XP; subir a nivel 2 cuesta 5.
    let leveled = false;
    let lastFightId = '';
    for (let i = 0; i < 3 && !leveled; i++) {
      const res = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
        opponentSlug: theirs.slug,
      });
      expect(res.status).toBe(200);
      expect(res.body.xpGained).toBeGreaterThanOrEqual(1);
      lastFightId = res.body.fightId;
      leveled = res.body.leveledUp;
    }
    expect(leveled).toBe(true);

    // Con una mejora pendiente no se puede pelear.
    const blocked = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
      opponentSlug: theirs.slug,
    });
    expect(blocked.status).toBe(409);

    const pending = await mine.browser.call('GET', `/api/brutes/${mine.slug}/level-up`);
    expect(pending.status).toBe(200);
    expect(pending.body.options).toHaveLength(2);

    const applied = await mine.browser.call('POST', `/api/brutes/${mine.slug}/level-up`, {
      choiceIndex: 1,
    });
    expect(applied.status).toBe(200);
    expect(applied.body.brute.level).toBe(2);
    expect(applied.body.brute.pendingLevelUp).toBe(false);

    // La repeticion es publica y trae todo lo necesario para animarla.
    const replay = await new Browser().call('GET', `/api/fights/${lastFightId}`);
    expect(replay.status).toBe(200);
    expect(replay.body.log[0].type).toBe('start');
    expect(replay.body.log.at(-1).type).toBe('end');
    expect(['A', 'B']).toContain(replay.body.winner);
    expect(replay.body.snapshotA.slug).toBe(mine.slug);

    const history = await new Browser().call('GET', `/api/brutes/${mine.slug}/fights`);
    expect(history.body.fights.length).toBeGreaterThan(0);
    expect(history.body.fights[0].opponent.slug).toBe(theirs.slug);
  });

  it('el record se apunta a los dos luchadores', async () => {
    const mine = await newFighter('marcador');
    const theirs = await newFighter('contrario');

    const res = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
      opponentSlug: theirs.slug,
    });
    const a = (await new Browser().call('GET', `/api/brutes/${mine.slug}`)).body;
    const b = (await new Browser().call('GET', `/api/brutes/${theirs.slug}`)).body;

    expect(a.wins + a.losses).toBe(1);
    expect(b.wins + b.losses).toBe(1);
    expect(a.wins).toBe(res.body.won ? 1 : 0);
    expect(b.wins).toBe(res.body.won ? 0 : 1);
  });

  it('corta a las 6 peleas diarias', async () => {
    const mine = await newFighter('cansado');
    const theirs = await newFighter('paciente');
    const fight = () =>
      mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, { opponentSlug: theirs.slug });

    let fights = 0;
    for (let i = 0; i < 6; i++) {
      const res = await fight();
      if (res.status === 409) {
        // Mejora pendiente: se resuelve y se sigue contando.
        await mine.browser.call('POST', `/api/brutes/${mine.slug}/level-up`, { choiceIndex: 0 });
        const retry = await fight();
        expect(retry.status).toBe(200);
      } else {
        expect(res.status).toBe(200);
      }
      fights += 1;
    }
    expect(fights).toBe(6);

    const profile = (await new Browser().call('GET', `/api/brutes/${mine.slug}`)).body;
    expect(profile.fightsLeftToday).toBe(0);

    const extra = await fight();
    expect(extra.status).toBe(429);
  });

  it('rechaza oponentes de nivel lejano y a uno mismo', async () => {
    const mine = await newFighter('exigente');
    await prisma.brute.update({ where: { slug: mine.slug }, data: { level: 10 } });
    const lejano = await newFighter('lejano');

    const res = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
      opponentSlug: lejano.slug,
    });
    expect(res.status).toBe(400);

    const yo = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
      opponentSlug: mine.slug,
    });
    expect(yo.status).toBe(400);
  });
});

describe('anti-abuso', () => {
  it('corta la creacion de luchadores por IP', async () => {
    const limited = await buildApp({ createLimit: 2 });
    const post = (name: string) =>
      limited.inject({ method: 'POST', url: '/api/brutes', payload: { name } });

    expect((await post(unique('cupo'))).statusCode).toBe(201);
    expect((await post(unique('cupo'))).statusCode).toBe(201);
    expect((await post(unique('cupo'))).statusCode).toBe(429);

    await limited.close();
  });
});

describe('moderacion', () => {
  it('acepta denuncias sobre un luchador existente', async () => {
    const { slug } = await newFighter('denunciado');
    const browser = new Browser();

    const ok = await browser.call('POST', '/api/reports', { slug, reason: 'Nombre de una marca' });
    expect(ok.status).toBe(201);
    expect(await prisma.report.count()).toBe(1);

    const missing = await browser.call('POST', '/api/reports', {
      slug: 'no-existe',
      reason: 'lo que sea',
    });
    expect(missing.status).toBe(404);
  });
});
