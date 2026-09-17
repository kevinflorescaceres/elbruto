/** Creacion de luchadores y progresion. Todo puro y derivado del nombre (PLAN.md §6). */
import { PETS, SKILLS, WEAPONS } from './catalog.js';
import { hashString, mulberry32, pick, randInt, weightedPick, type Rng } from './prng.js';
import type { Appearance, Brute, LevelUpOption, Stat } from './types.js';

export const STATS: readonly Stat[] = ['endurance', 'strength', 'agility', 'speed'];

const MIN_STAT = 2;
const STARTING_POINTS = 12;

/** Nombre -> slug canonico. Es la identidad del luchador y la base de su semilla. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const bruteSeed = (slug: string): number => hashString(slug);

// 10 por punto (PLAN.md §6 decia 6): con 6 los combates duraban ~27 turnos,
// demasiado poco para animarlos. Ajustado con `pnpm balance`.
export const maxHpFor = (endurance: number): number => 50 + endurance * 10;

export const xpForLevel = (level: number): number => level * 5;

function rollStats(rng: Rng): Record<Stat, number> {
  const stats: Record<Stat, number> = {
    endurance: MIN_STAT,
    strength: MIN_STAT,
    agility: MIN_STAT,
    speed: MIN_STAT,
  };
  for (let i = 0; i < STARTING_POINTS - MIN_STAT * STATS.length; i++) {
    stats[pick(rng, STATS)] += 1;
  }
  return stats;
}

function rollAppearance(rng: Rng): Appearance {
  return {
    body: randInt(rng, 0, 2),
    head: randInt(rng, 0, 3),
    hair: randInt(rng, 0, 5),
    skinColor: randInt(rng, 0, 4),
    hairColor: randInt(rng, 0, 5),
    clothColor: randInt(rng, 0, 7),
  };
}

/** Un luchador nuevo: nivel 1, una mejora al azar y los punos. */
export function createBrute(name: string): Brute {
  const slug = slugify(name);
  if (slug.length === 0) throw new Error('El nombre no produce un slug valido');

  const rng = mulberry32(bruteSeed(slug));
  const stats = rollStats(rng);

  const brute: Brute = {
    name,
    slug,
    level: 1,
    xp: 0,
    ...stats,
    weapons: [],
    skills: [],
    pets: [],
    appearance: rollAppearance(rng),
  };

  // Una mejora inicial. Sin mascota: a nivel 1 desequilibra el combate.
  const starter = weightedPick<LevelUpOption>(rng, [
    { value: { type: 'weapon', id: pick(rng, WEAPONS).id }, weight: 50 },
    { value: { type: 'skill', id: pick(rng, SKILLS).id }, weight: 50 },
  ]);

  return applyLevelUpOption(brute, starter);
}

/** Clave estable de una opcion: sirve para no ofrecer dos veces lo mismo. */
export function optionKey(option: LevelUpOption): string {
  if (option.type === 'stat') {
    const gains = STATS.filter((s) => option.gains[s] !== undefined)
      .map((s) => `${s}+${option.gains[s] ?? 0}`)
      .join(',');
    return `stat:${gains}`;
  }
  return `${option.type}:${option.id}`;
}

function rollStatOption(rng: Rng): LevelUpOption {
  if (randInt(rng, 1, 2) === 1) {
    return { type: 'stat', gains: { [pick(rng, STATS)]: 2 } };
  }
  const first = pick(rng, STATS);
  const second = pick(
    rng,
    STATS.filter((s) => s !== first),
  );
  return { type: 'stat', gains: { [first]: 1, [second]: 1 } };
}

function rollOption(rng: Rng, brute: Brute): LevelUpOption {
  const freeWeapons = WEAPONS.filter((w) => !brute.weapons.includes(w.id));
  const freeSkills = SKILLS.filter((s) => !brute.skills.includes(s.id));
  const freePets = PETS.filter((p) => !brute.pets.includes(p.id));

  // Los pesos de PLAN.md §6. Una categoria agotada pasa a 0 y el resto se reparte solo.
  return weightedPick<LevelUpOption>(rng, [
    {
      value:
        freeWeapons.length > 0
          ? { type: 'weapon', id: pick(rng, freeWeapons).id }
          : rollStatOption(rng),
      // El arma N-esima casi no aporta: solo se empuna una. Pasado el tercer
      // arma el peso baja para que la eleccion siga significando algo (`pnpm balance`).
      weight: freeWeapons.length === 0 ? 0 : brute.weapons.length < 3 ? 35 : 10,
    },
    {
      value:
        freeSkills.length > 0
          ? { type: 'skill', id: pick(rng, freeSkills).id }
          : rollStatOption(rng),
      weight: freeSkills.length > 0 ? 35 : 0,
    },
    {
      value:
        freePets.length > 0 ? { type: 'pet', id: pick(rng, freePets).id } : rollStatOption(rng),
      weight: freePets.length > 0 ? 10 : 0,
    },
    { value: rollStatOption(rng), weight: 20 },
  ]);
}

/**
 * Las 2 opciones del nivel `brute.level`. Determinista: mismo luchador y mismo
 * nivel dan siempre las mismas opciones, asi el servidor puede regenerarlas.
 */
export function rollLevelUpOptions(brute: Brute): [LevelUpOption, LevelUpOption] {
  const rng = mulberry32(hashString(`${brute.slug}:lvl:${brute.level}`));
  const first = rollOption(rng, brute);

  // Las opciones de stat siempre existen, asi que esto termina.
  let second = rollOption(rng, brute);
  for (let i = 0; i < 20 && optionKey(second) === optionKey(first); i++) {
    second = i < 10 ? rollOption(rng, brute) : rollStatOption(rng);
  }
  if (optionKey(second) === optionKey(first)) {
    second = { type: 'stat', gains: { endurance: 2 } };
    if (optionKey(second) === optionKey(first)) second = { type: 'stat', gains: { strength: 2 } };
  }

  return [first, second];
}

/** Aplica una mejora. Devuelve un luchador nuevo, no muta el original. */
export function applyLevelUpOption(brute: Brute, option: LevelUpOption): Brute {
  switch (option.type) {
    case 'weapon':
      return { ...brute, weapons: [...brute.weapons, option.id] };
    case 'skill':
      return { ...brute, skills: [...brute.skills, option.id] };
    case 'pet':
      return { ...brute, pets: [...brute.pets, option.id] };
    case 'stat': {
      const next = { ...brute };
      for (const stat of STATS) next[stat] += option.gains[stat] ?? 0;
      return next;
    }
  }
}

/** Suma XP y sube de nivel si llega. Devuelve cuantos niveles subio. */
export function addXp(brute: Brute, amount: number): { brute: Brute; levelsGained: number } {
  let next = { ...brute, xp: brute.xp + amount };
  let levelsGained = 0;
  while (next.xp >= xpForLevel(next.level)) {
    next = { ...next, xp: next.xp - xpForLevel(next.level), level: next.level + 1 };
    levelsGained += 1;
  }
  return { brute: next, levelsGained };
}

/**
 * Sube al luchador hasta `targetLevel` eligiendo una de las 2 opciones con `rng`.
 * Lo usan el script de balance y (Fase 2) el seed de bots.
 */
export function growTo(brute: Brute, targetLevel: number, rng: Rng): Brute {
  let next = brute;
  while (next.level < targetLevel) {
    const options = rollLevelUpOptions(next);
    next = applyLevelUpOption(next, options[randInt(rng, 0, 1)] ?? options[0]);
    next = { ...next, level: next.level + 1 };
  }
  return next;
}
