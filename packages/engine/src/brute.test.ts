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

  it('empieza a nivel 1 con exactamente una mejora y sin mascota', () => {
    for (const name of NAMES) {
      const brute = createBrute(name);
      expect(brute.level).toBe(1);
      expect(brute.pets).toEqual([]);
      expect(brute.weapons.length + brute.skills.length).toBe(1);
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

  it('growTo llega al nivel pedido sin perder mejoras', () => {
    const grown = growTo(createBrute('Garbanzo'), 20, mulberry32(3));
    expect(grown.level).toBe(20);
    expect(grown.weapons.length + grown.skills.length).toBeGreaterThan(1);
    expect(new Set(grown.weapons).size).toBe(grown.weapons.length);
  });
});
