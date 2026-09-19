/**
 * Mide el ritmo de la animacion: cuanto dura una accion de un peleon.
 *
 * El objetivo es aproximadamente 1 segundo por accion, que es el ritmo al que
 * un combate se sigue con la vista sin aburrir. Como `pnpm balance`, existe
 * porque es un numero invisible que solo se puede ajustar midiendolo.
 *
 *   pnpm --filter @camorra/web ritmo
 */
import { createBrute, growTo, mulberry32, simulate, type FightEvent } from '@camorra/engine';
import { planFight, SEGUNDOS_POR_ACCION } from './fightScene.js';

const COMBATES = Number(process.argv[2] ?? 400);

let duracion = 0;
let turnos = 0;
let eventos = 0;
const duraciones: number[] = [];
const porAccion: number[] = [];

for (let seed = 0; seed < COMBATES; seed++) {
  const rng = mulberry32(seed);
  const level = (seed % 30) + 1;
  const a = growTo(createBrute(`ritmo-${seed}-a`), level, rng);
  const b = growTo(createBrute(`ritmo-${seed}-b`), level, rng);

  const result = simulate(a, b, seed * 13 + 1);
  const scene = planFight({
    ...result,
    snapshotA: { appearance: a.appearance, slug: a.slug },
    snapshotB: { appearance: b.appearance, slug: b.slug },
  });

  duracion += scene.duration;
  duraciones.push(scene.duration);
  turnos += (result.log as FightEvent[]).filter((e) => e.type === 'turn').length;
  eventos += result.log.length;

  // Lo que de verdad se nota: cuanto varia una accion respecto de otra.
  let inicio: number | null = null;
  for (const beat of scene.beats) {
    const abre = beat.moves.some((m) => m.kind === 'pulse');
    if (!abre) continue;
    if (inicio !== null) porAccion.push(beat.at - inicio);
    inicio = beat.at;
  }
}

duraciones.sort((x, y) => x - y);
const percentil = (p: number): number => duraciones[Math.floor(duraciones.length * p)] ?? 0;

console.log(`\n${COMBATES} combates, niveles 1-30\n`);
console.log(`acciones por combate   ${(turnos / COMBATES).toFixed(1)}`);
console.log(`eventos por combate    ${(eventos / COMBATES).toFixed(1)}`);
console.log(`duracion media         ${(duracion / COMBATES).toFixed(1)} s`);
console.log(`  mas corto (p5)       ${percentil(0.05).toFixed(1)} s`);
console.log(`  mediana              ${percentil(0.5).toFixed(1)} s`);
console.log(`  mas largo (p95)      ${percentil(0.95).toFixed(1)} s`);
console.log(
  `\nSEGUNDOS POR ACCION    ${(duracion / turnos).toFixed(2)} s   ` +
    `(objetivo ~${SEGUNDOS_POR_ACCION.toFixed(2)})`,
);

porAccion.sort((x, y) => x - y);
const pa = (p: number): number => porAccion[Math.floor(porAccion.length * p)] ?? 0;
const media = porAccion.reduce((s, v) => s + v, 0) / porAccion.length;
const desviacion = Math.sqrt(
  porAccion.reduce((s, v) => s + (v - media) ** 2, 0) / porAccion.length,
);
console.log(`\nDispersion entre acciones (${porAccion.length} medidas):`);
console.log(`  minima               ${(porAccion[0] ?? 0).toFixed(2)} s`);
console.log(`  mediana              ${pa(0.5).toFixed(2)} s`);
console.log(`  maxima               ${(porAccion.at(-1) ?? 0).toFixed(2)} s`);
console.log(
  `  desviacion tipica    ${desviacion.toFixed(2)} s   (cuanto mas baja, menos tirones)\n`,
);
