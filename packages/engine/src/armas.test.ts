import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo } from './brute.js';
import { getWeapon } from './catalog.js';
import { mulberry32 } from './prng.js';
import { ENGINE_VERSION, simulate } from './simulate.js';
import type { Brute, FightEvent } from './types.js';
import { validateLog } from './validate.js';

/** Sin manas ni bichos: el resultado depende solo de las armas. */
function peleon(weapons: string[], slug = 'arm'): Brute {
  return { ...growTo(createBrute(slug), 5, mulberry32(1)), weapons, skills: [], pets: [] };
}

const SEMILLAS = 300;

function combate(armasA: string[], seed: number, armasB: string[] = []) {
  return simulate(peleon(armasA, `arm-a-${seed}`), peleon(armasB, `arm-b-${seed}`), seed);
}

/** Lanzamientos de A con esa arma, y si el ultimo acabo el combate. */
function lanzamientos(log: FightEvent[], weapon: string) {
  const idx = log.flatMap((e, i) =>
    e.type === 'throwWeapon' && e.id === 'A' && e.weapon === weapon ? [i] : [],
  );
  const ultimo = idx.at(-1);
  const resto = ultimo === undefined ? [] : log.slice(ultimo + 1);
  const siguienteTurno = resto.findIndex((e) => e.type === 'turn');
  const tramo = siguienteTurno === -1 ? resto : resto.slice(0, siguienteTurno);
  const mata = tramo.some((e) => e.type === 'death' && e.id !== 'A');
  return { veces: idx.length, tramo, mata };
}

group('arrojadizas con stock', () => {
  it('la botija se lanza una sola vez y se pierde rota', () => {
    let lanzadas = 0;
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['botija'], seed);
      const { veces, tramo, mata } = lanzamientos(log, 'botija');
      expect(veces, `semilla ${seed}`).toBeLessThanOrEqual(1);
      if (veces === 0 || mata) continue;
      lanzadas += 1;
      expect(tramo, `semilla ${seed}`).toContainEqual({
        type: 'weaponLost',
        id: 'A',
        weapon: 'botija',
        reason: 'rota',
      });
    }
    expect(lanzadas).toBeGreaterThan(SEMILLAS / 2);
  });

  it('una botija que mata a un bicho tampoco vuelve: el combate sigue', () => {
    for (let seed = 0; seed < SEMILLAS * 3; seed++) {
      const a = peleon(['botija', 'garrafa'], `arm-a-${seed}`);
      const b = { ...peleon([], `arm-b-${seed}`), pets: ['chucho', 'chucho'] };
      const { log } = simulate(a, b, seed);
      for (const weapon of ['botija', 'garrafa']) {
        const veces = log.filter((e) => e.type === 'throwWeapon' && e.weapon === weapon).length;
        expect(veces, `semilla ${seed}: ${weapon}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('los cuchillos se lanzan como mucho 5 veces y luego se agotan', () => {
    let agotados = 0;
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['cuchillos'], seed);
      const { veces, tramo, mata } = lanzamientos(log, 'cuchillos');
      expect(veces, `semilla ${seed}`).toBeLessThanOrEqual(5);
      const perdida = log.find((e) => e.type === 'weaponLost' && e.weapon === 'cuchillos');
      if (veces < 5) {
        expect(perdida, `semilla ${seed}`).toBeUndefined();
        continue;
      }
      if (mata) continue;
      agotados += 1;
      expect(tramo, `semilla ${seed}`).toContainEqual({
        type: 'weaponLost',
        id: 'A',
        weapon: 'cuchillos',
        reason: 'agotada',
      });
    }
    expect(agotados).toBeGreaterThan(0);
  });
});

group('armas que se rompen', () => {
  it('la banqueta se rompe en mas de la mitad de los combates largos', () => {
    let largos = 0;
    let rotas = 0;
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const result = combate(['banqueta'], seed);
      if (result.turns < 20) continue;
      largos += 1;
      if (result.log.some((e) => e.type === 'weaponLost' && e.weapon === 'banqueta')) rotas += 1;
    }
    expect(largos).toBeGreaterThan(20);
    expect(rotas / largos).toBeGreaterThan(0.5);
  });

  it('un arma que se rompe a mitad de combo corta el combo', () => {
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['banqueta', 'tranca', 'porra'], seed, ['chuzo']);
      let cortado: string | null = null;
      for (const e of log) {
        if (e.type === 'weaponLost' && e.reason === 'rota') cortado = e.id;
        else if (e.type === 'attack' && e.id === cortado) cortado = null;
        else if (e.type === 'hit' && e.id === cortado) {
          throw new Error(`semilla ${seed}: ${e.id} sigue golpeando con el arma rota`);
        }
      }
    }
  });

  it('nunca se rompe un arma en un ataque esquivado', () => {
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['banqueta', 'tranca'], seed, ['chuzo', 'porra']);
      log.forEach((e, i) => {
        if (e.type !== 'weaponLost' || e.reason !== 'rota') return;
        let desde = i;
        const esSuAtaque = (p: FightEvent | undefined) => p?.type === 'attack' && p.id === e.id;
        while (desde > 0 && !esSuAtaque(log[desde])) desde--;
        const tramo = log.slice(desde, i);
        expect(
          tramo.some((p) => p.type === 'hit' || p.type === 'block'),
          `semilla ${seed}`,
        ).toBe(true);
        expect(tramo.at(-1)?.type, `semilla ${seed}`).not.toBe('evade');
      });
    }
  });

  it('nunca hay un ataque con un arma ya perdida', () => {
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['banqueta', 'botija', 'cuchillos'], seed, ['tranca', 'garrafa']);
      const perdidas = new Set<string>();
      for (const e of log) {
        if (e.type === 'weaponLost') perdidas.add(`${e.id}:${e.weapon}`);
        if (e.type === 'attack' || e.type === 'throwWeapon' || e.type === 'drawWeapon') {
          expect(perdidas.has(`${e.id}:${e.weapon}`), `semilla ${seed}: ${e.type}`).toBe(false);
        }
      }
    }
  });

  it('el log sigue siendo valido: nada de weaponLost sobre un muerto', () => {
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const result = combate(['banqueta', 'botija'], seed, ['garrafa', 'tranca']);
      expect(validateLog(result), `semilla ${seed}`).toEqual([]);
    }
  });

  it('tras la muerte que acaba el combate solo queda el end', () => {
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(['banqueta', 'botija', 'cuchillos'], seed, ['garrafa', 'tranca']);
      const fatal = log.findIndex((e) => e.type === 'death' && (e.id === 'A' || e.id === 'B'));
      expect(
        log.slice(fatal + 1).map((e) => e.type),
        `semilla ${seed}`,
      ).toEqual(['end']);
    }
  });

  it('una arrojadiza no se rompe por impacto aunque el catalogo lo diga: solo gasta tiros', () => {
    const botija = getWeapon('botija');
    const original = botija.breakChance;
    botija.breakChance = 100;
    try {
      for (let seed = 0; seed < SEMILLAS; seed++) {
        const { log } = combate(['botija'], seed);
        const perdidas = log.filter((e) => e.type === 'weaponLost' && e.weapon === 'botija');
        expect(perdidas.length, `semilla ${seed}`).toBeLessThanOrEqual(1);
      }
    } finally {
      botija.breakChance = original;
    }
  });

  it('Zurriagazo con una arrojadiza en la mano la lanza y gasta el tiro', () => {
    let usados = 0;
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const a = { ...peleon(['cascote'], `arm-a-${seed}`), skills: ['zurriagazo'] };
      const { log } = simulate(a, peleon([], `arm-b-${seed}`), seed);
      log.forEach((e, i) => {
        if (e.type !== 'attack' || e.id !== 'A' || e.weapon !== 'cascote') return;
        expect(log[i - 1]?.type, `semilla ${seed}: cascote de cerca`).toBe('throwWeapon');
      });
      if (log.some((e) => e.type === 'skill' && e.skill === 'zurriagazo')) usados += 1;
      const tiros = log.filter((e) => e.type === 'throwWeapon' && e.weapon === 'cascote');
      expect(tiros.length, `semilla ${seed}`).toBeLessThanOrEqual(3);
    }
    expect(usados).toBeGreaterThan(20);
  });

  it('tras perder el arma, con armas restantes, la siguiente accion suele ser drawWeapon', () => {
    const armas = ['banqueta', 'jifero', 'chaira', 'puntilla', 'porra', 'verduguillo', 'tranca'];
    let casos = 0;
    let saca = 0;
    for (let seed = 0; seed < SEMILLAS; seed++) {
      const { log } = combate(armas, seed, ['chuzo']);
      log.forEach((e, i) => {
        if (e.type !== 'weaponLost' || e.id !== 'A') return;
        const turno = log.findIndex((p, j) => j > i && p.type === 'turn' && p.id === 'A');
        if (turno === -1) return;
        const accion = log[turno + 1];
        if (accion === undefined) return;
        casos += 1;
        if (accion.type === 'drawWeapon') saca += 1;
      });
    }
    expect(casos).toBeGreaterThan(30);
    expect(saca / casos).toBeGreaterThan(0.45);
  });
});

it('ENGINE_VERSION es 6', () => {
  expect(ENGINE_VERSION).toBe(6);
});
