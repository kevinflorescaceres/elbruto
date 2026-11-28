import { describe, expect, it } from 'vitest';
import { PETS, SKILLS, WEAPONS } from './catalog.js';
import {
  addXp,
  applyLevelUpOption,
  createBrute,
  growTo,
  optionKey,
  rollLevelUpOptions,
  slugify,
  STATS,
  xpForLevel,
} from './brute.js';
import { mulberry32 } from './prng.js';

const NAMES = ['Garbanzo', 'La Tuerta', 'Pericote', 'Zurdo del Arrabal', 'Ñoño'];

describe('createBrute', () => {
  it('es determinista y depende solo del slug', () => {
    expect(createBrute('Garbanzo')).toEqual(createBrute('Garbanzo'));
    expect(createBrute('GARBANZO').slug).toBe(createBrute('garbanzo').slug);
  });

  it('nombres distintos dan luchadores distintos', () => {
    const seen = new Set(NAMES.map((n) => JSON.stringify(createBrute(n))));
    expect(seen.size).toBe(NAMES.length);
  });

  it('reparte 12 puntos con minimo 2 en cada stat', () => {
    for (const name of NAMES) {
      const brute = createBrute(name);
      // Las mejoras iniciales nunca son de stat, asi que el reparto se ve intacto.
      const total = STATS.reduce((sum, s) => sum + brute[s], 0);
      expect(total).toBe(12);
      for (const stat of STATS) expect(brute[stat]).toBeGreaterThanOrEqual(2);
    }
  });

  it('empieza a nivel 1 con una sola maña, sin arma ni mascota', () => {
    for (let i = 0; i < 200; i++) {
      const brute = createBrute(`novato numero ${i}`);
      expect(brute.level).toBe(1);
      expect(brute.pets).toEqual([]);
      expect(brute.weapons).toEqual([]);
      expect(brute.skills).toHaveLength(1);
      // Desarmar no sirve a nivel 1: nadie tiene arma.
      expect(brute.skills).not.toContain('desjarrete');
    }
  });

  it('slugify normaliza acentos, espacios y mayusculas', () => {
    expect(slugify('  El Ñoño  Tuerto ')).toBe('el-nono-tuerto');
    expect(() => createBrute('!!!')).toThrow();
  });
});

describe('rollLevelUpOptions', () => {
  it('es determinista para el mismo luchador y nivel', () => {
    const brute = createBrute('Garbanzo');
    expect(rollLevelUpOptions(brute)).toEqual(rollLevelUpOptions(brute));
  });

  it('nunca ofrece dos veces lo mismo ni algo que ya se tiene', () => {
    const rng = mulberry32(5);
    for (const name of NAMES) {
      let brute = createBrute(name);
      for (let level = 1; level < 40; level++) {
        const [a, b] = rollLevelUpOptions(brute);
        expect(optionKey(a)).not.toBe(optionKey(b));
        for (const option of [a, b]) {
          if (option.type === 'weapon') expect(brute.weapons).not.toContain(option.id);
          if (option.type === 'skill') expect(brute.skills).not.toContain(option.id);
          if (option.type === 'pet') expect(brute.pets).not.toContain(option.id);
        }
        brute = applyLevelUpOption(brute, rng() < 0.5 ? a : b);
        brute = { ...brute, level: brute.level + 1 };
      }
    }
  });

  it('sigue dando opciones con el catalogo agotado', () => {
    const base = createBrute('Garbanzo');
    const full = {
      ...base,
      level: 50,
      weapons: WEAPONS.map((w) => w.id),
      skills: SKILLS.map((s) => s.id),
      pets: PETS.map((p) => p.id),
    };
    const [a, b] = rollLevelUpOptions(full);
    expect(a.type).toBe('stat');
    expect(b.type).toBe('stat');
    expect(optionKey(a)).not.toBe(optionKey(b));
  });
});

describe('progresion', () => {
  it('addXp sube de nivel y conserva el sobrante', () => {
    const brute = createBrute('Garbanzo');
    expect(xpForLevel(1)).toBe(5);

    const once = addXp(brute, 4);
    expect(once.levelsGained).toBe(0);
    expect(once.brute.xp).toBe(4);

    const twice = addXp(once.brute, 2);
    expect(twice.levelsGained).toBe(1);
    expect(twice.brute.level).toBe(2);
    expect(twice.brute.xp).toBe(1);
  });

  it('xpForLevel va por tramos: 5N hasta el 4, 2N+10 del 5 al 9 y 2N+9 desde el 10', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([5, 10, 15, 20]);
    expect([5, 6, 7, 8, 9].map(xpForLevel)).toEqual([20, 22, 24, 26, 28]);
    expect([10, 11, 20].map(xpForLevel)).toEqual([29, 31, 49]);
  });

  it('subir de nivel nunca cuesta menos que el nivel anterior', () => {
    for (let level = 1; level < 200; level++) {
      expect(xpForLevel(level + 1)).toBeGreaterThanOrEqual(xpForLevel(level));
    }
  });

  it('addXp sube como mucho un nivel y guarda el sobrante', () => {
    const { brute, levelsGained } = addXp(createBrute('Garbanzo'), 100);
    expect(levelsGained).toBe(1);
    expect(brute.level).toBe(2);
    expect(brute.xp).toBe(95);
  });

  it('growTo llega al nivel pedido sin perder mejoras', () => {
    const grown = growTo(createBrute('Garbanzo'), 20, mulberry32(3));
    expect(grown.level).toBe(20);
    expect(grown.weapons.length + grown.skills.length).toBeGreaterThan(1);
    expect(new Set(grown.weapons).size).toBe(grown.weapons.length);
  });
});

describe('armas nuevas en el reparto', () => {
  it('rollLevelUpOptions puede ofrecer garrafa, cuchillos y vara', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 2000 && vistas.size < 3; i++) {
      const brute = { ...createBrute(`reparto-${i}`), level: 2 + (i % 20) };
      for (const option of rollLevelUpOptions(brute)) {
        if (option.type === 'weapon') vistas.add(option.id);
      }
      for (const id of [...vistas])
        if (!['garrafa', 'cuchillos', 'vara'].includes(id)) vistas.delete(id);
    }
    expect([...vistas].sort()).toEqual(['cuchillos', 'garrafa', 'vara']);
  });
});

describe('sexo', () => {
  it('la mujer y el hombre del mismo nombre solo difieren en el sexo', () => {
    for (const n of ['Rosca la Brava', 'Matías Puñetas', 'Chirlo de la Cava']) {
      const h = createBrute(n, 'male');
      const m = createBrute(n, 'female');
      expect(m.appearance.gender).toBe('female');
      expect(h.appearance.gender).toBe('male');
      const { appearance: am, ...restoM } = m;
      const { appearance: ah, ...restoH } = h;
      expect(restoM).toEqual(restoH);
      expect({ ...am, gender: 'male' }).toEqual(ah);
    }
  });

  it('sin sexo, createBrute crea un hombre', () => {
    expect(createBrute('Nadie').appearance.gender).toBe('male');
  });
});
