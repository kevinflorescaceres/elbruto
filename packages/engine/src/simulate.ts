/**
 * Simulacion de combate. Pura y determinista: misma entrada, mismo log (PLAN.md §2).
 * El cliente solo reproduce el log; aqui se decide todo.
 */
import { maxHpFor } from './brute.js';
import { FISTS, getPet, getSkill, getWeapon } from './catalog.js';
import { chance, clamp, mulberry32, randInt, weightedPick, type Rng } from './prng.js';
import type {
  Brute,
  Combatant,
  FightEvent,
  FightResult,
  Pet,
  Side,
  Skill,
  Weapon,
} from './types.js';

// 2: el luchador empuna su mejor arma en vez de una al azar, y cada categoria
// tiene efecto propio (pesada ignora armadura, larga rompe guardias, rapida no
// se contesta, lanzar dobla el dano).
export const ENGINE_VERSION = 2;

const MAX_TURNS = 500;

/** Las mascotas pelean con una "arma" sintetica: asi comparten el camino de ataque. */
function petWeapon(pet: Pet): Weapon {
  return {
    id: `pet:${pet.id}`,
    name: pet.name,
    category: 'rapida',
    damage: pet.damage,
    accuracy: pet.accuracy,
    baseDelay: pet.baseDelay,
    strengthScale: 0,
    reach: 1,
    throwable: false,
  };
}

export interface CombatStats {
  maxHp: number;
  strength: number;
  agility: number;
  speed: number;
  armor: number;
  block: number;
  counter: number;
  actives: Skill[];
}

/**
 * Stats con las habilidades pasivas ya aplicadas. Es lo que se ve en el combate,
 * y tambien lo que debe mostrar la ficha del luchador.
 */
export function combatStats(brute: Brute): CombatStats {
  let maxHp = maxHpFor(brute.endurance);
  let { strength, agility, speed } = brute;
  let armor = 0;
  let block = 0;
  let counter = 0;
  const actives: Skill[] = [];

  for (const id of brute.skills) {
    const skill = getSkill(id);
    if (skill.type === 'activa') {
      actives.push(skill);
      continue;
    }
    const effect = skill.effect;
    switch (effect.kind) {
      case 'maxHp':
        maxHp += effect.amount;
        break;
      case 'armor':
        armor += effect.amount;
        break;
      case 'block':
        block += effect.chance;
        break;
      case 'counter':
        counter += effect.chance;
        break;
      case 'stat':
        if (effect.stat === 'endurance') maxHp += effect.amount * 10;
        if (effect.stat === 'strength') strength += effect.amount;
        if (effect.stat === 'agility') agility += effect.amount;
        if (effect.stat === 'speed') speed += effect.amount;
        break;
      default:
        break;
    }
  }

  return { maxHp, strength, agility, speed, armor, block, counter, actives };
}

function buildFighter(brute: Brute, side: Side): Combatant {
  const { maxHp, strength, agility, speed, armor, block, counter, actives } = combatStats(brute);

  // Entra con un arma en la mano: empezar a punos desperdiciaba turnos. Cual,
  // se decide despues, cuando se conoce al rival (ver `equipBest`).
  const weapons = brute.weapons.map(getWeapon);

  return {
    id: side,
    name: brute.name,
    side,
    isPet: false,
    hp: maxHp,
    maxHp,
    strength,
    agility,
    speed,
    weapons,
    weapon: FISTS,
    armor,
    block,
    counter,
    actives,
    next: 0,
  };
}

function buildPet(petId: string, side: Side, index: number): Combatant {
  const pet = getPet(petId);
  const weapon = petWeapon(pet);
  return {
    id: `${side}-pet-${index}`,
    name: pet.name,
    side,
    isPet: true,
    hp: pet.hp,
    maxHp: pet.hp,
    strength: 0,
    agility: pet.agility,
    speed: 0,
    weapons: [],
    weapon,
    armor: 0,
    block: 0,
    counter: 0,
    actives: [],
    next: 0,
  };
}

/**
 * Dano esperado por unidad de tiempo contra un rival concreto. Es la medida que
 * decide que arma se empuna.
 */
export function weaponScore(weapon: Weapon, attacker: Combatant, defender: Combatant): number {
  const dano = weapon.damage + Math.floor((attacker.strength * weapon.strengthScale) / 100);
  const acierto = clamp(weapon.accuracy - defender.agility * 2, 10, 95);
  const espera = Math.max(1, Math.round((weapon.baseDelay * 10) / (10 + attacker.speed)));
  return (dano * acierto) / espera;
}

/** La mejor de las que lleva encima, o los punos si no lleva ninguna. */
function bestWeapon(fighter: Combatant, rival: Combatant): Weapon {
  let mejor = FISTS;
  let puntos = weaponScore(FISTS, fighter, rival);
  for (const weapon of fighter.weapons) {
    const suyo = weaponScore(weapon, fighter, rival);
    // A igualdad gana la primera: el recorrido es estable y el resultado determinista.
    if (suyo > puntos) {
      puntos = suyo;
      mejor = weapon;
    }
  }
  return mejor;
}

interface State {
  rng: Rng;
  log: FightEvent[];
  fighters: Combatant[];
  turns: number;
}

const isAlive = (c: Combatant): boolean => c.hp > 0;

const delayOf = (c: Combatant): number =>
  Math.max(1, Math.round((c.weapon.baseDelay * 10) / (10 + c.speed)));

function enemiesOf(state: State, actor: Combatant): Combatant[] {
  return state.fighters.filter((c) => c.side !== actor.side && isAlive(c));
}

/** El luchador rival pesa mas que sus mascotas (PLAN.md §6). */
function chooseTarget(state: State, actor: Combatant): Combatant | undefined {
  const enemies = enemiesOf(state, actor);
  if (enemies.length === 0) return undefined;
  return weightedPick(
    state.rng,
    enemies.map((enemy) => ({ value: enemy, weight: enemy.isPet ? 1 : 5 })),
  );
}

interface AttackOptions {
  allowCounter: boolean;
  multiplier: number;
}

function resolveAttack(
  state: State,
  attacker: Combatant,
  defender: Combatant,
  weapon: Weapon,
  { allowCounter, multiplier }: AttackOptions,
): void {
  // Las armas cortas obligan a acercarse: el cliente lo anima.
  if (weapon.reach <= 2) state.log.push({ type: 'move', id: attacker.id, target: defender.id });
  state.log.push({ type: 'attack', id: attacker.id, target: defender.id, weapon: weapon.id });

  const hitChance = clamp(weapon.accuracy - defender.agility * 2, 10, 95);
  if (!chance(state.rng, hitChance)) {
    state.log.push({ type: 'evade', id: defender.id });
    return;
  }

  // Un arma larga es dificil de parar: llega antes de que cierres la guardia.
  const bloqueo = weapon.category === 'larga' ? Math.floor(defender.block / 2) : defender.block;
  if (bloqueo > 0 && chance(state.rng, bloqueo)) {
    state.log.push({ type: 'block', id: defender.id });
    return;
  }

  state.log.push({ type: 'hit', id: attacker.id, target: defender.id });

  const base = weapon.damage + Math.floor((attacker.strength * weapon.strengthScale) / 100);
  const varied = Math.floor((base * randInt(state.rng, 80, 120)) / 100);
  // Un golpe pesado pasa por encima del acolchado: la dureza no lo amortigua.
  const armadura = weapon.category === 'pesada' ? 0 : defender.armor;
  const amount = Math.max(1, Math.floor(varied * multiplier) - armadura);

  defender.hp = Math.max(0, defender.hp - amount);
  state.log.push({ type: 'damage', id: defender.id, amount, hp: defender.hp });

  if (!isAlive(defender)) {
    state.log.push({ type: 'death', id: defender.id });
    return;
  }

  // A un arma rapida no se le contesta: ya ha vuelto a la guardia.
  const contestable = allowCounter && weapon.category !== 'rapida';
  if (contestable && defender.counter > 0 && chance(state.rng, defender.counter)) {
    state.log.push({ type: 'counter', id: defender.id, target: attacker.id });
    resolveAttack(state, defender, attacker, defender.weapon, {
      allowCounter: false,
      multiplier: 1,
    });
  }
}

function attack(state: State, actor: Combatant, multiplier = 1): void {
  const target = chooseTarget(state, actor);
  if (target === undefined) return;
  resolveAttack(state, actor, target, actor.weapon, { allowCounter: true, multiplier });
}

function drawWeapon(state: State, actor: Combatant): void {
  const rival = state.fighters.find((c) => c.side !== actor.side && !c.isPet);
  if (rival === undefined) return attack(state, actor);

  // Se echa mano de la mejor que quede, no de una al azar: tras perder un arma
  // esto es lo que devuelve al luchador a su mejor forma.
  const next = bestWeapon(actor, rival);
  if (next.id === actor.weapon.id) return attack(state, actor);

  actor.weapon = next;
  state.log.push({ type: 'drawWeapon', id: actor.id, weapon: next.id });
}

function throwWeapon(state: State, actor: Combatant): void {
  const thrown = actor.weapon;
  const target = chooseTarget(state, actor);
  if (target === undefined) return;

  state.log.push({ type: 'throwWeapon', id: actor.id, target: target.id, weapon: thrown.id });
  // Se lanza y se pierde: vuelve a los punos antes de que el arma haga efecto.
  actor.weapons = actor.weapons.filter((w) => w.id !== thrown.id);
  actor.weapon = FISTS;
  // Tirar el arma es jugarsela: si no doliera el doble, nunca compensaria.
  resolveAttack(state, actor, target, thrown, { allowCounter: false, multiplier: 2 });
}

/** Solo tiene sentido desarmar a quien lleva algo. */
function canUseSkill(state: State, actor: Combatant, skill: Skill): boolean {
  if (skill.effect.kind !== 'disarm') return true;
  return enemiesOf(state, actor).some((e) => !e.isPet && e.weapon.id !== FISTS.id);
}

function useSkill(state: State, actor: Combatant): void {
  const usable = actor.actives.filter((s) => canUseSkill(state, actor, s));
  if (usable.length === 0) return attack(state, actor);

  const skill = weightedPick(
    state.rng,
    usable.map((s) => ({ value: s, weight: 1 })),
  );
  actor.actives = actor.actives.filter((s) => s.id !== skill.id);
  state.log.push({ type: 'skill', id: actor.id, skill: skill.id });

  switch (skill.effect.kind) {
    case 'heal': {
      const amount = Math.floor((actor.maxHp * skill.effect.percent) / 100);
      actor.hp = Math.min(actor.maxHp, actor.hp + amount);
      state.log.push({ type: 'heal', id: actor.id, amount, hp: actor.hp });
      break;
    }
    case 'power':
      attack(state, actor, skill.effect.multiplier);
      break;
    case 'disarm': {
      const target = enemiesOf(state, actor).find((e) => !e.isPet && e.weapon.id !== FISTS.id);
      if (target === undefined) break;
      const lost = target.weapon;
      target.weapons = target.weapons.filter((w) => w.id !== lost.id);
      target.weapon = FISTS;
      state.log.push({ type: 'disarm', id: actor.id, target: target.id, weapon: lost.id });
      break;
    }
    default:
      break;
  }
}

function act(state: State, actor: Combatant): void {
  if (actor.isPet) return attack(state, actor);

  const canDraw = actor.weapons.some((w) => w.id !== actor.weapon.id);
  const canThrow = actor.weapon.throwable && actor.weapon.id !== FISTS.id;
  const canSkill = actor.actives.some((s) => canUseSkill(state, actor, s));

  const action = weightedPick<'attack' | 'draw' | 'throw' | 'skill'>(state.rng, [
    { value: 'attack', weight: 60 },
    { value: 'draw', weight: canDraw ? 12 : 0 },
    // Tirar el arma dobla el dano pero la pierdes: merece considerarse mas a menudo
    // ahora que compensa.
    { value: 'throw', weight: canThrow ? 12 : 0 },
    { value: 'skill', weight: canSkill ? 18 : 0 },
  ]);

  switch (action) {
    case 'draw':
      return drawWeapon(state, actor);
    case 'throw':
      return throwWeapon(state, actor);
    case 'skill':
      return useSkill(state, actor);
    default:
      return attack(state, actor);
  }
}

/** El siguiente en actuar: menor `next`, y a igualdad el de indice menor. */
function nextActor(state: State): Combatant | undefined {
  let best: Combatant | undefined;
  for (const c of state.fighters) {
    if (!isAlive(c)) continue;
    if (best === undefined || c.next < best.next) best = c;
  }
  return best;
}

const brutesOf = (state: State): [Combatant, Combatant] => {
  const a = state.fighters[0];
  const b = state.fighters[1];
  if (a === undefined || b === undefined) throw new Error('faltan luchadores');
  return [a, b];
};

export function simulate(bruteA: Brute, bruteB: Brute, seed: number): FightResult {
  const rng = mulberry32(seed);
  const a = buildFighter(bruteA, 'A');
  const b = buildFighter(bruteB, 'B');
  const state: State = {
    rng,
    log: [{ type: 'start', seed }],
    fighters: [
      a,
      b,
      ...bruteA.pets.map((id, i) => buildPet(id, 'A', i)),
      ...bruteB.pets.map((id, i) => buildPet(id, 'B', i)),
    ],
    turns: 0,
  };

  // Cada uno empuna su mejor arma contra ESE rival: tener un arma mejor debe
  // mejorarte, no anadir un boleto mas al sorteo.
  a.weapon = bestWeapon(a, b);
  b.weapon = bestWeapon(b, a);

  // Iniciativa inicial repartida al azar: si no, el lado A siempre pega primero.
  for (const c of state.fighters) {
    c.next = randInt(state.rng, 0, 10);
    state.log.push({
      type: 'spawn',
      id: c.id,
      name: c.name,
      side: c.side,
      isPet: c.isPet,
      hp: c.hp,
      maxHp: c.maxHp,
      weapon: c.weapon.id,
    });
  }

  while (state.turns < MAX_TURNS && isAlive(a) && isAlive(b)) {
    const actor = nextActor(state);
    if (actor === undefined) break;

    state.turns += 1;
    state.log.push({ type: 'turn', id: actor.id });
    act(state, actor);
    actor.next += delayOf(actor);
  }

  const [fa, fb] = brutesOf(state);
  // Si se agotan los turnos gana quien conserve mayor porcentaje de vida (PLAN.md §6).
  const winner: Side = !isAlive(fb)
    ? 'A'
    : !isAlive(fa)
      ? 'B'
      : fa.hp / fa.maxHp >= fb.hp / fb.maxHp
        ? 'A'
        : 'B';

  state.log.push({ type: 'end', winner, turns: state.turns });

  return { engineVersion: ENGINE_VERSION, seed, winner, turns: state.turns, log: state.log };
}
