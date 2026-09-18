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

// 3: reglas de combate.md. Vida con termino por nivel, intervalos en la escala
// nueva con azar, combos de hasta 3 impactos, defensa en orden esquiva /
// bloqueo / contraataque, arrojadizas que no se agotan y mascotas que cuestan
// resistencia.
export const ENGINE_VERSION = 3;

const MAX_TURNS = 500;

/** COMBATE.md §4.2: tope de impactos encadenados y cuanto pierde cada uno. */
const MAX_COMBO_HITS = 3;
const MAX_COMBO_CHANCE = 45;
const COMBO_FALLOFF = 0.7;
/** Lo que anade un arma larga a la probabilidad de contestar tras esquivar. */
const COUNTER_LARGA = 25;

/** Las mascotas pelean con una "arma" sintetica: asi comparten el camino de ataque. */
function petWeapon(pet: Pet): Weapon {
  return {
    id: `pet:${pet.id}`,
    name: pet.name,
    category: 'rapida',
    damage: pet.damage,
    accuracyBonus: pet.accuracyBonus,
    interval: pet.interval,
    comboRate: 0,
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
  // Las mascotas se pagan en resistencia (COMBATE.md §4.8). El suelo es 0: la
  // vida base de 50 no se toca.
  const coste = brute.pets.reduce((suma, id) => suma + getPet(id).enduranceCost, 0);
  const endurance = Math.max(0, brute.endurance - coste);
  let maxHp = maxHpFor(endurance, brute.level);
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
        if (effect.stat === 'endurance') maxHp += effect.amount * 6;
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
 * Probabilidad de que el defensor se aparte, en tanto por ciento (COMBATE.md §4.6).
 * La base sale de ajustar hasta que los ataques fallados caen en el 20-35% que
 * pide §3: con la base 10 del documento se quedaban en el 12,6%.
 */
const DODGE_BASE = 22;

export function dodgeChance(weapon: Weapon, defender: Combatant): number {
  // Techo 36 y no el 40 del documento: con 40, a nivel 10 los fallos se iban al
  // 35,6% y el objetivo de §3 es 35 como mucho.
  return clamp(DODGE_BASE + defender.agility * 2 - weapon.accuracyBonus, 5, 36);
}

/** Tiempo hasta la siguiente accion de quien empuna esta arma (COMBATE.md §4.3). */
export function delayWith(weapon: Weapon, speed: number): number {
  return Math.max(1, Math.round((weapon.interval * 100) / (10 + speed)));
}

/**
 * Dano esperado por unidad de tiempo contra un rival concreto. Es la medida que
 * decide que arma se empuna.
 */
export function weaponScore(weapon: Weapon, attacker: Combatant, defender: Combatant): number {
  const dano = weapon.damage + Math.floor((attacker.strength * weapon.strengthScale) / 100);
  const conecta = 100 - dodgeChance(weapon, defender);
  return (dano * conecta) / delayWith(weapon, attacker.speed);
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

const delayOf = (c: Combatant): number => delayWith(c.weapon, c.speed);

/**
 * El intervalo real lleva una pizca de azar. Sin esto, dos luchadores iguales
 * alternan en lockstep perfecto y nunca encadenan dos acciones, que es justo lo
 * que COMBATE.md §1.2 dice que no debe pasar. `delayWith` se queda limpia
 * porque la usa la eleccion de arma, que debe ser determinista.
 */
const JITTER = 18;

const delayReal = (rng: Rng, c: Combatant): number =>
  Math.max(1, Math.round((delayOf(c) * randInt(rng, 100 - JITTER, 100 + JITTER)) / 100));

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

  // Defensa en el orden de COMBATE.md §4.6: esquiva, bloqueo, contraataque.
  if (chance(state.rng, dodgeChance(weapon, defender))) {
    state.log.push({ type: 'evade', id: defender.id });

    // Quien se aparta con un arma larga en la mano tiene sitio para responder.
    const contra = defender.counter + (defender.weapon.category === 'larga' ? COUNTER_LARGA : 0);
    if (allowCounter && contra > 0 && chance(state.rng, contra)) {
      state.log.push({ type: 'counter', id: defender.id, target: attacker.id });
      resolveAttack(state, defender, attacker, defender.weapon, {
        allowCounter: false,
        multiplier: 1,
      });
    }
    return;
  }

  if (defender.block > 0 && chance(state.rng, defender.block)) {
    state.log.push({ type: 'block', id: defender.id });
    return;
  }

  // Una piedra bien puesta vale mas que un brazo fuerte (COMBATE.md §4.5).
  const aporte =
    weapon.category === 'arrojadiza'
      ? attacker.agility * 0.7 + attacker.strength * 0.3
      : attacker.strength;
  const base = weapon.damage + Math.floor((aporte * weapon.strengthScale) / 100);

  // Combos (COMBATE.md §4.2): hasta 3 impactos encadenados, cada uno al 70% del
  // anterior, y cada uno se tira contra la misma probabilidad.
  const combo = clamp(weapon.comboRate + attacker.agility * 2, 0, MAX_COMBO_CHANCE);
  const varied = Math.floor((base * randInt(state.rng, 80, 120)) / 100);
  // Un golpe pesado pasa por encima del acolchado: la dureza no lo amortigua.
  const armadura = weapon.category === 'pesada' ? 0 : defender.armor;
  // El 70% es del dano DEL IMPACTO ANTERIOR, no de la base: por eso la variacion
  // se tira una sola vez y despues solo decae. Asi cada golpe pega menos que el
  // previo siempre, y no solo de media.
  let golpeado = Math.floor(varied * multiplier);

  for (let golpe = 0; golpe < MAX_COMBO_HITS; golpe++) {
    state.log.push({ type: 'hit', id: attacker.id, target: defender.id });

    const amount = Math.max(1, golpeado - armadura);

    defender.hp = Math.max(0, defender.hp - amount);
    state.log.push({ type: 'damage', id: defender.id, amount, hp: defender.hp });

    if (!isAlive(defender)) {
      state.log.push({ type: 'death', id: defender.id });
      return;
    }
    if (!chance(state.rng, combo)) return;
    golpeado = Math.floor(golpeado * COMBO_FALLOFF);
  }
}

function attack(state: State, actor: Combatant, multiplier = 1): void {
  // Una arrojadiza no se usa de cerca: atacar con ella es lanzarla.
  if (actor.weapon.category === 'arrojadiza' && multiplier === 1) {
    return throwWeapon(state, actor);
  }
  const target = chooseTarget(state, actor);
  if (target === undefined) return;
  resolveAttack(state, actor, target, actor.weapon, { allowCounter: true, multiplier });
}

function drawWeapon(state: State, actor: Combatant): void {
  const rival = state.fighters.find((c) => c.side !== actor.side && !c.isPet);
  if (rival === undefined) return attack(state, actor);

  // Se echa mano de la mejor que quede, no de una al azar.
  const next = bestWeapon(actor, rival);
  if (next.id === actor.weapon.id) return attack(state, actor);

  // Cambiar de arma descarta la anterior (COMBATE.md §4.7): por eso el catalogo
  // se va agotando dentro del combate y no se repite siempre la misma pelea.
  const soltada = actor.weapon;
  if (soltada.id !== FISTS.id && soltada.category !== 'arrojadiza') {
    actor.weapons = actor.weapons.filter((w) => w.id !== soltada.id);
  }
  actor.weapon = next;
  state.log.push({ type: 'drawWeapon', id: actor.id, weapon: next.id });
}

function throwWeapon(state: State, actor: Combatant): void {
  const thrown = actor.weapon;
  const target = chooseTarget(state, actor);
  if (target === undefined) return;

  state.log.push({ type: 'throwWeapon', id: actor.id, target: target.id, weapon: thrown.id });

  // Una arrojadiza es munición: no se agota ni se pierde (COMBATE.md §4.7).
  // Cualquier otra arma lanzada queda inutilizable el resto del combate.
  if (thrown.category !== 'arrojadiza') {
    actor.weapons = actor.weapons.filter((w) => w.id !== thrown.id);
    actor.weapon = FISTS;
  }
  resolveAttack(state, actor, target, thrown, { allowCounter: false, multiplier: 1 });
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
  // El rango va en las unidades de intervalo, que ahora son centenas.
  for (const c of state.fighters) {
    c.next = randInt(state.rng, 0, Math.floor(delayOf(c) / 2));
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
    actor.next += delayReal(state.rng, actor);
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
