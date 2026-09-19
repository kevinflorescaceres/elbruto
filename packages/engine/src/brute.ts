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

/**
 * Semilla propia de un campo de apariencia (ARTE-Y-TOKENS.md §1.3).
 *
 * El PRNG secuencial es fragil: meter una tirada antes de otra le cambia la cara
 * a todos los peleones existentes. Con una semilla por campo, anadir un campo
 * manana no toca ninguno de los que ya hay. Nunca mas.
 */
export const fieldSeed = (slug: string, campo: string): number => hashString(`${slug}:${campo}`);

/** Valor de un campo de apariencia en [0, max], derivado solo de su semilla. */
export const appearanceField = (slug: string, campo: string, max: number): number =>
  randInt(mulberry32(fieldSeed(slug, campo)), 0, max);

/**
 * Campos de apariencia que no salen del PRNG secuencial. Cada uno con su
 * semilla, asi que anadir el siguiente no toca a ninguno de estos.
 *
 * Los usan por igual el motor al crear y el arte al pintar: un peleon creado
 * antes de que existiera un campo lo obtiene calculado desde su propio slug.
 */
export const RANGOS_POR_SEMILLA = {
  clothColor2: 7,
  brow: 3,
  mouth: 3,
  beard: 5,
  mark: 5,
} as const;

export type CampoPorSemilla = keyof typeof RANGOS_POR_SEMILLA;

export const campoDeApariencia = (slug: string, campo: CampoPorSemilla): number =>
  appearanceField(slug, campo, RANGOS_POR_SEMILLA[campo]);

export const clothColor2For = (slug: string): number => campoDeApariencia(slug, 'clothColor2');

/**
 * Vida maxima (COMBATE.md §4.1). El termino por nivel sube la vida en paralelo
 * al dano, para que los combates no se acorten al subir de nivel.
 */
export const maxHpFor = (endurance: number, level: number): number =>
  Math.floor(50 + endurance * 6 + level * 1.5);

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

/**
 * Los seis primeros campos salen del PRNG secuencial, en este orden exacto: son
 * los que ya tienen peleones creados y no se pueden mover. Lo nuevo entra por
 * semilla de campo, que no consume del secuencial y por tanto no desplaza nada.
 */
function rollAppearance(rng: Rng, slug: string): Appearance {
  return {
    body: randInt(rng, 0, 2),
    head: randInt(rng, 0, 3),
    hair: randInt(rng, 0, 5),
    skinColor: randInt(rng, 0, 4),
    hairColor: randInt(rng, 0, 5),
    clothColor: randInt(rng, 0, 7),
    clothColor2: campoDeApariencia(slug, 'clothColor2'),
    brow: campoDeApariencia(slug, 'brow'),
    mouth: campoDeApariencia(slug, 'mouth'),
    beard: campoDeApariencia(slug, 'beard'),
    mark: campoDeApariencia(slug, 'mark'),
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
    appearance: rollAppearance(rng, slug),
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
    return { type: 'stat', gains: { [pick(rng, STATS)]: 3 } };
  }
  const first = pick(rng, STATS);
  const second = pick(
    rng,
    STATS.filter((s) => s !== first),
  );
  return { type: 'stat', gains: { [first]: 2, [second]: 1 } };
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
  // Siempre una de estadistica (COMBATE.md §2): asi nunca te obligan a llevarte
  // un arma o un bicho que no quieres.
  const first = rollStatOption(rng);

  let second = rollOption(rng, brute);
  for (let i = 0; i < 20 && optionKey(second) === optionKey(first); i++) {
    second = rollOption(rng, brute);
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
