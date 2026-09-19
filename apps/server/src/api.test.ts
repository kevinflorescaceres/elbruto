/**
 * Criterio de "listo" de la Fase 2: crear un luchador, pelear, subir de nivel y
 * ver el combate, solo con llamadas HTTP.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NAME_MAX, NAME_MIN, NAME_PATTERN } from '@camorra/shared';
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
    const { browser, slug } = await newFighter('camorrista');

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
    expect((await browser.call('POST', '/api/brutes', { name: 'el puta amo' })).status).toBe(400);
  });

  it('fija el limite de longitud en NAME_MIN y NAME_MAX', async () => {
    const browser = new Browser();
    const largo = 'x'.repeat(NAME_MAX);

    // Justo por debajo y justo por encima fallan; los extremos validos pasan.
    expect(
      (await browser.call('POST', '/api/brutes', { name: 'x'.repeat(NAME_MIN - 1) })).status,
    ).toBe(400);
    expect((await browser.call('POST', '/api/brutes', { name: largo + 'x' })).status).toBe(400);
    expect((await browser.call('POST', '/api/brutes', { name: 'x'.repeat(NAME_MIN) })).status).toBe(
      201,
    );
    expect((await browser.call('POST', '/api/brutes', { name: largo })).status).toBe(201);
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

    // Perder da 1 XP y ganar 2, asi que 5 peleas suben de nivel pase lo que pase.
    // Con 3 dependia de ganar alguna: el test salia flaky.
    let leveled = false;
    let lastFightId = '';
    for (let i = 0; i < 5 && !leveled; i++) {
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

describe('detras de un proxy', () => {
  it('sin TRUST_PROXY no se hace caso a X-Forwarded-For', async () => {
    // Si se creyera a ciegas, cualquiera se saltaria el limite cambiando la cabecera.
    const suyo = await buildApp({ createLimit: 1 });
    const crear = (ip: string) =>
      suyo.inject({
        method: 'POST',
        url: '/api/brutes',
        payload: { name: `proxy ${Math.random().toString(36).slice(2, 7)}` },
        headers: { 'x-forwarded-for': ip },
      });

    expect((await crear('1.1.1.1')).statusCode).toBe(201);
    expect((await crear('2.2.2.2')).statusCode).toBe(429);
    await suyo.close();
  });
});

describe('metadatos para compartir', () => {
  // Solo aplica con el frontend construido; en desarrollo la web la sirve Vite.
  const construido = existsSync(resolve(import.meta.dirname, '../../web/dist/index.html'));

  it.runIf(construido)('el combate lleva titulo y descripcion propios', async () => {
    const mine = await newFighter('comparte');
    const theirs = await newFighter('rivalote');
    const res = await mine.browser.call('POST', `/api/brutes/${mine.slug}/fights`, {
      opponentSlug: theirs.slug,
    });

    const page = await app.inject({ method: 'GET', url: `/fight/${res.body.fightId}` });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('og:title');
    expect(page.body).toContain('og:image');
    expect(page.body).toContain('le gano a');
  });

  it.runIf(construido)('la portada tambien lleva metadatos', async () => {
    // @fastify/static servia index.html en "/" y se saltaba la inyeccion.
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('og:site_name');
    expect(page.body).toContain('og:image');
  });

  it('ningun nombre aceptado puede llevar HTML', async () => {
    // El nombre acaba dentro de content="..." en la cabecera. La primera defensa
    // es el patron: si algun dia se amplia, este test cae y avisa.
    const browser = new Browser();
    for (const peligroso of ['ma"><script x', 'uno<b>dos', 'tres & cuatro', "cinco'seis"]) {
      const res = await browser.call('POST', '/api/brutes', { name: peligroso });
      expect(res.status).toBe(400);
    }
    for (const caracter of ['<', '>', '"', '&', "'", '/']) {
      expect(NAME_PATTERN.test(`nombre${caracter}malo`)).toBe(false);
    }
  });

  it.runIf(construido)('una ruta de api inexistente sigue devolviendo JSON', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
  });
});

describe('razones para volver', () => {
  it('el ranking ordena por nivel y deja fuera a los bots', async () => {
    const fuerte = await newFighter('mandamas');
    const flojo = await newFighter('novato');
    await prisma.brute.update({ where: { slug: fuerte.slug }, data: { level: 9, wins: 4 } });
    // Un bot de nivel muy alto no debe colarse en la tabla.
    await prisma.brute.create({
      data: {
        name: 'Bot Altisimo',
        slug: 'bot-altisimo',
        isBot: true,
        level: 30,
        endurance: 5,
        strength: 5,
        agility: 5,
        speed: 5,
        appearance: { body: 0, head: 0, hair: 0, skinColor: 0, hairColor: 0, clothColor: 0 },
      },
    });

    const res = await new Browser().call('GET', '/api/ranking');
    expect(res.status).toBe(200);

    const slugs = res.body.brutes.map((b: any) => b.slug);
    expect(slugs).not.toContain('bot-altisimo');
    expect(slugs.indexOf(fuerte.slug)).toBeLessThan(slugs.indexOf(flojo.slug));
    expect(res.body.brutes[0].rank).toBe(1);
    expect(res.body.total).toBe(2);
  });

  it('la ficha trae el puesto y cuando vuelven las peleas', async () => {
    const mine = await newFighter('puesto');
    const perfil = (await new Browser().call('GET', `/api/brutes/${mine.slug}`)).body;

    expect(perfil.rank).toBeGreaterThan(0);
    // La proxima medianoche esta siempre por delante y dentro de 24 horas.
    const vuelta = new Date(perfil.nextResetAt).getTime();
    expect(vuelta).toBeGreaterThan(Date.now());
    expect(vuelta).toBeLessThanOrEqual(Date.now() + 24 * 3600 * 1000 + 1000);
  });

  it('listar peleones no cuela el indice del array como puesto', async () => {
    // brutes.map(rowToProfile) pasaba el indice al segundo parametro y el
    // primero salia con puesto 0, que el esquema rechaza y tumba la portada.
    const browser = new Browser();
    await browser.call('POST', '/api/brutes', { name: 'Primero del Cupo' });
    await browser.call('POST', '/api/brutes', { name: 'Segundo del Cupo' });

    const me = await browser.call('GET', '/api/me');
    expect(me.status).toBe(200);
    expect(me.body.brutes).toHaveLength(2);
    for (const brute of me.body.brutes) expect(brute.rank).toBeNull();
  });

  it('un bot no tiene puesto en el ranking', async () => {
    await prisma.brute.create({
      data: {
        name: 'Bot Sin Puesto',
        slug: 'bot-sin-puesto',
        isBot: true,
        level: 3,
        endurance: 3,
        strength: 3,
        agility: 3,
        speed: 3,
        appearance: { body: 0, head: 0, hair: 0, skinColor: 0, hairColor: 0, clothColor: 0 },
      },
    });
    const perfil = (await new Browser().call('GET', '/api/brutes/bot-sin-puesto')).body;
    expect(perfil.rank).toBeNull();
  });
});

describe('pupilos', () => {
  it('reclutar da al maestro una pelea diaria mas', async () => {
    const maestro = await newFighter('maestro');
    const antes = (await new Browser().call('GET', `/api/brutes/${maestro.slug}`)).body;
    expect(antes.pupils).toBe(0);
    expect(antes.fightsLeftToday).toBe(6);

    // Otro navegador: otro duenio.
    const recluta = new Browser();
    const creado = await recluta.call('POST', '/api/brutes', {
      name: unique('recluta'),
      masterSlug: maestro.slug,
    });
    expect(creado.status).toBe(201);
    expect(creado.body.brute.master.slug).toBe(maestro.slug);

    const despues = (await new Browser().call('GET', `/api/brutes/${maestro.slug}`)).body;
    expect(despues.pupils).toBe(1);
    expect(despues.fightsLeftToday).toBe(7);
  });

  it('reclutarse a uno mismo no cuenta', async () => {
    // Mismo navegador, mismo duenio: el enlace no da nada.
    const { browser, slug } = await newFighter('tramposo');
    const otro = await browser.call('POST', '/api/brutes', {
      name: unique('clon'),
      masterSlug: slug,
    });

    expect(otro.status).toBe(201);
    expect(otro.body.brute.master).toBeNull();

    const perfil = (await new Browser().call('GET', `/api/brutes/${slug}`)).body;
    expect(perfil.pupils).toBe(0);
    expect(perfil.fightsLeftToday).toBe(6);
  });

  it('el premio tiene tope y un bot no puede ser maestro', async () => {
    const maestro = await newFighter('popular');
    // Ocho reclutas, pero el tope son seis peleas extra.
    for (let i = 0; i < 8; i++) {
      await new Browser().call('POST', '/api/brutes', {
        name: unique(`seguidor${i}`),
        masterSlug: maestro.slug,
      });
    }
    const perfil = (await new Browser().call('GET', `/api/brutes/${maestro.slug}`)).body;
    expect(perfil.pupils).toBe(8);
    expect(perfil.fightsLeftToday).toBe(12);

    await prisma.brute.create({
      data: {
        name: 'Bot Reclutador',
        slug: 'bot-reclutador',
        isBot: true,
        level: 2,
        endurance: 3,
        strength: 3,
        agility: 3,
        speed: 3,
        appearance: { body: 0, head: 0, hair: 0, skinColor: 0, hairColor: 0, clothColor: 0 },
      },
    });
    const conBot = await new Browser().call('POST', '/api/brutes', {
      name: unique('inocente'),
      masterSlug: 'bot-reclutador',
    });
    expect(conBot.body.brute.master).toBeNull();
  });

  it('las peleas extra se pueden usar de verdad', async () => {
    const maestro = await newFighter('currante');
    const rival = await newFighter('sufrido');
    await new Browser().call('POST', '/api/brutes', {
      name: unique('apoyo'),
      masterSlug: maestro.slug,
    });

    const pelear = () =>
      maestro.browser.call('POST', `/api/brutes/${maestro.slug}/fights`, {
        opponentSlug: rival.slug,
      });

    let hechas = 0;
    for (let i = 0; i < 7; i++) {
      const res = await pelear();
      if (res.status === 409) {
        await maestro.browser.call('POST', `/api/brutes/${maestro.slug}/level-up`, {
          choiceIndex: 0,
        });
        expect((await pelear()).status).toBe(200);
      } else {
        expect(res.status).toBe(200);
      }
      hechas += 1;
    }
    // Siete peleas: seis de base mas la del pupilo. La octava ya no.
    expect(hechas).toBe(7);
    expect((await pelear()).status).toBe(429);
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
