/**
 * Script de balance (PLAN.md §6 y fase 1). Simula miles de combates entre
 * luchadores del mismo nivel e informa de la tasa de victoria de cada elemento
 * del catalogo. Criterio: nada debe pasar del 60%.
 *
 * Solo cuenta los combates donde UN lado tiene el elemento y el otro no; si no,
 * todo tiende al 50% y no se ve nada.
 */
import { createBrute, growTo } from './brute.js';
import { PETS, SKILLS, WEAPONS } from './catalog.js';
import { mulberry32, randInt } from './prng.js';
import { medir, porCategoria } from './sensacion.js';
import { simulate } from './simulate.js';
import type { Brute } from './types.js';

const FIGHTS = Number(process.argv[2] ?? 10_000);
/** `pnpm balance 5000 8` fija el nivel; sin el, niveles 1-30 mezclados. */
const FIXED_LEVEL = process.argv[3] === undefined ? undefined : Number(process.argv[3]);
const MAX_LEVEL = 30;

interface Tally {
  fights: number;
  wins: number;
}

const tallies = new Map<string, Tally>();

function record(key: string, won: boolean): void {
  const tally = tallies.get(key) ?? { fights: 0, wins: 0 };
  tally.fights += 1;
  if (won) tally.wins += 1;
  tallies.set(key, tally);
}

const owned = (brute: Brute): Set<string> =>
  new Set([...brute.weapons, ...brute.skills, ...brute.pets]);

const rng = mulberry32(20260917);
let totalTurns = 0;
let capped = 0;
let winsA = 0;

for (let i = 0; i < FIGHTS; i++) {
  const level = FIXED_LEVEL ?? randInt(rng, 1, MAX_LEVEL);
  const a = growTo(createBrute(`bal-${i}-a`), level, rng);
  const b = growTo(createBrute(`bal-${i}-b`), level, rng);

  const result = simulate(a, b, randInt(rng, 0, 2 ** 30));
  totalTurns += result.turns;
  if (result.turns >= 500) capped += 1;
  if (result.winner === 'A') winsA += 1;

  const [hasA, hasB] = [owned(a), owned(b)];
  for (const id of hasA) if (!hasB.has(id)) record(id, result.winner === 'A');
  for (const id of hasB) if (!hasA.has(id)) record(id, result.winner === 'B');
}

const names = new Map<string, string>([
  ...WEAPONS.map((w) => [w.id, `arma     ${w.name}`] as const),
  ...SKILLS.map((s) => [s.id, `habilid. ${s.name}`] as const),
  ...PETS.map((p) => [p.id, `mascota  ${p.name}`] as const),
]);

const rows = [...tallies.entries()]
  .map(([id, t]) => ({ id, rate: (t.wins / t.fights) * 100, fights: t.fights }))
  .sort((x, y) => y.rate - x.rate);

console.log(
  `\n${FIGHTS} combates, ${FIXED_LEVEL === undefined ? `niveles 1-${MAX_LEVEL}` : `nivel ${FIXED_LEVEL}`}\n`,
);
console.log(`turnos medios      ${(totalTurns / FIGHTS).toFixed(1)}`);
console.log(`tope de 500 turnos ${((capped / FIGHTS) * 100).toFixed(2)}%`);
console.log(`victorias lado A   ${((winsA / FIGHTS) * 100).toFixed(1)}%  (sesgo de iniciativa)\n`);

for (const row of rows) {
  const flag = row.rate > 60 || row.rate < 40 ? '  <-- fuera de rango' : '';
  const label = (names.get(row.id) ?? row.id).padEnd(28);
  console.log(`${label}${row.rate.toFixed(1).padStart(5)}%  (n=${row.fights})${flag}`);
}

// --- Objetivos de sensacion (COMBATE.md §3) ---
const fuera: string[] = [];
for (const nivel of [1, 10]) {
  console.log(`\nSensacion, nivel ${nivel} contra nivel ${nivel}, sin bichos:\n`);
  for (const m of medir(2000, nivel)) {
    const dentro = m.valor >= m.min && m.valor <= m.max;
    const marca = dentro ? '' : `  <-- fuera de [${m.min}, ${m.max}]`;
    console.log(`  ${m.nombre.padEnd(28)}${m.valor.toFixed(1).padStart(6)}${m.unidad}${marca}`);
    // Nivel 10 comparte objetivos salvo los de conteo, que son de nivel 1.
    if (!dentro && nivel === 1) fuera.push(`${m.nombre} = ${m.valor.toFixed(1)}${m.unidad}`);
  }
}

// --- Categorias de arma cara a cara (COMBATE.md §6) ---
console.log('\nCategorias de arma, ambos armados, nivel 1:\n');
for (const [cat, fila] of [...porCategoria(4000)].sort(
  (x, y) => y[1].gana / y[1].con - x[1].gana / x[1].con,
)) {
  const tasa = (fila.gana / fila.con) * 100;
  const marca = tasa > 60 || tasa < 40 ? '  <-- fuera de [40, 60]' : '';
  console.log(`  ${cat.padEnd(14)}${tasa.toFixed(1).padStart(5)}%  (n=${fila.con})${marca}`);
  if (tasa > 60 || tasa < 40) fuera.push(`categoria ${cat} = ${tasa.toFixed(1)}%`);
}

const worst = rows.filter((r) => r.rate > 60);
console.log(
  worst.length === 0
    ? '\nOK: nada supera el 60%.\n'
    : `\nFALLA: ${worst.length} por encima del 60%.\n`,
);
process.exit(worst.length === 0 ? 0 : 1);
