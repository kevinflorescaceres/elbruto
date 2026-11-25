/**
 * La linea de tiempo montada, muestreada fotograma a fotograma. Las hojas de
 * contacto pintan cada animacion sola, y lo que se rompe es lo que pasa cuando
 * se solapan: la vuelta de un golpe suena encima del siguiente. Por eso aqui
 * se monta el combate de verdad (con un rig sin dibujo) y se mira la pose.
 */
import { describe as group, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { createBrute, growTo, mulberry32, simulate } from '@camorra/engine';
import { planFight, type Move, type Scene } from './fightScene.js';
import { ANIMATIONS } from './art/poses.js';
import {
  ANTEBRAZO_HASTA_PUNO,
  brazoAtrasDelante,
  girar,
  LARGO_BRAZO,
  type PartName,
} from './art/parts.js';

/** Las partes de cada rig, por id de actor, para leerlas desde el test. */
const rigs = new Map<
  string,
  { parts: Map<PartName, Container>; base: Map<PartName, { x: number; y: number }> }
>();

vi.mock('./pixiScene.js', async (original) => {
  const real = await original<typeof import('./pixiScene.js')>();
  const { lookFrom } = await import('./art/parts.js');
  const vacio = () => new Container();
  return {
    ...real,
    drawEscenario: vacio,
    drawGround: vacio,
    makeFloater: vacio,
    makeImpacto: vacio,
    makeRing: vacio,
    makeProjectile: vacio,
    makeAnnounce: vacio,
    changeWeapon: () => undefined,
    drawActor: (actor: import('./fightScene.js').Actor) => {
      const root = new Container();
      root.x = actor.home.x * real.SIZE.width;
      const body = new Container();
      body.scale.set(actor.facing * real.ESCALA_ACTOR, real.ESCALA_ACTOR);
      root.addChild(body);
      if (actor.appearance === null) {
        return { root, body, rig: null, hpFill: null, hpDom: null, actor };
      }
      const look = lookFrom(actor.appearance, actor.slug);
      const parts = new Map<PartName, Container>();
      const base = new Map<PartName, { x: number; y: number }>();
      for (const joint of look.rig) {
        const node = new Container();
        node.position.set(joint.at[0], joint.at[1]);
        parts.set(joint.name, node);
        base.set(joint.name, { x: joint.at[0], y: joint.at[1] });
      }
      rigs.set(actor.id, { parts, base });
      const rig = { root: new Container(), parts, hand: new Container(), base, caras: new Map() };
      return { root, body, rig, hpFill: null, hpDom: null, actor };
    },
  };
});

const { buildTimeline } = await import('./timeline.js');

function fight(seed: number) {
  const rng = mulberry32(seed);
  const level = (seed % 30) + 1;
  const a = growTo(createBrute(`linea-${seed}-a`), level, rng);
  const b = growTo(createBrute(`linea-${seed}-b`), level, rng);
  return {
    ...simulate(a, b, seed * 17 + 3),
    snapshotA: { appearance: a.appearance, slug: a.slug },
    snapshotB: { appearance: b.appearance, slug: b.slug },
  };
}

type Pose = Move & { kind: 'pose' };

/** Cada golpe de un combo con el instante en que pega: el del impacto siguiente. */
function golpesEncadenados(scene: Scene): { golpe: Pose; contacto: number; turno: number }[] {
  const out: { golpe: Pose; contacto: number; turno: number }[] = [];
  scene.beats.forEach((beat, i) => {
    for (const move of beat.moves) {
      if (move.kind !== 'pose' || move.encadena !== true || move.parada === true) continue;
      const siguiente = scene.beats[i + 1];
      if (siguiente !== undefined) {
        out.push({ golpe: move, contacto: siguiente.at, turno: beat.duration });
      }
    }
  });
  return out;
}

function leer(parts: Map<PartName, Container>) {
  const p = (name: PartName) => parts.get(name) ?? new Container();
  return {
    brazoDelante: p('armFront'),
    antebrazoDelante: p('forearmFront'),
    brazoAtras: p('armBack'),
    antebrazoAtras: p('forearmBack'),
  };
}

/** El centro del puno, en el sistema del torso. */
function puno(brazo: Container, antebrazo: Container): [number, number] {
  const [cx, cy] = girar(0, LARGO_BRAZO, brazo.rotation);
  const [px, py] = girar(0, ANTEBRAZO_HASTA_PUNO, brazo.rotation + antebrazo.rotation);
  return [brazo.x + cx + px, brazo.y + cy + py];
}

group('buildTimeline', () => {
  it('en cada golpe de un combo el brazo que pega llega estirado y el otro sigue en guardia', () => {
    const vistos = { punos: 0, cruzados: 0, armas: 0, remates: 0 };
    for (let seed = 0; seed < 160; seed++) {
      rigs.clear();
      const scene = planFight(fight(seed));
      const golpes = golpesEncadenados(scene);
      if (golpes.length === 0) continue;
      const tl = buildTimeline(new Container(), scene, () => undefined, { A: null, B: null });
      tl.pause();
      for (const { golpe, contacto, turno } of golpes) {
        const rig = rigs.get(golpe.id);
        if (rig === undefined) continue;
        const { brazoDelante, antebrazoDelante, brazoAtras, antebrazoAtras } = leer(rig.parts);
        // Un pelo despues del contacto: el gesto ya ha llegado.
        tl.seek(contacto + 0.01, false);
        const dx = brazoAtras.x - (rig.base.get('armBack')?.x ?? 0);
        const capa = brazoAtrasDelante(dx, brazoAtras.rotation, antebrazoAtras.rotation);
        const donde = `semilla ${seed}, ${golpe.anim} en ${contacto.toFixed(2)}`;

        if (golpe.anim === 'attackCruzado') {
          vistos.cruzados++;
          // El brazo de atras, por delante del torso y con el hombro adelantado:
          // antes, la vuelta del golpe anterior lo mandaba detras justo aqui.
          expect(brazoAtras.rotation, donde).toBeLessThan(-1);
          expect(capa, donde).toBe(true);
          // El de delante, recogido en guardia: antebrazo doblado hacia arriba.
          expect(antebrazoDelante.rotation, donde).toBeLessThan(-1.5);
        } else {
          expect(brazoDelante.rotation, donde).toBeLessThan(-1.2);
          // Con o sin arma, la mano de atras va delante del pecho: en guardia,
          // o sobre el mango si el arma es a dos manos.
          expect(capa, donde).toBe(true);
          if (golpe.anim === 'attackPesada' || golpe.anim === 'attackLarga') {
            vistos.armas++;
            const [fx, fy] = puno(brazoDelante, antebrazoDelante);
            const [bx, by] = puno(brazoAtras, antebrazoAtras);
            expect(Math.hypot(bx - fx, by - fy), donde).toBeLessThan(16);
          } else vistos.punos++;
        }

        if (golpe.remata === true) {
          vistos.remates++;
          // El remate se queda clavado: cuanto sigue el brazo donde pego. La
          // animacion dura `turno / contacto`; un golpe normal se sostiene un
          // 15% de eso y se deja ir, el remate un 25% sin moverse.
          const brazo = golpe.anim === 'attackCruzado' ? brazoAtras : brazoDelante;
          const pego = brazo.rotation;
          let clavado = 0;
          for (let dt = 0; dt < 0.3; dt += 1 / 240) {
            tl.seek(contacto + 0.01 + dt, false);
            if (Math.abs(brazo.rotation - pego) > 0.02) break;
            clavado = dt;
          }
          const dura = turno / (ANIMATIONS[golpe.anim].contacto ?? 1);
          expect(clavado, donde).toBeGreaterThan(0.21 * dura);
        }
      }
      tl.kill();
    }
    expect(vistos.punos).toBeGreaterThan(0);
    expect(vistos.cruzados).toBeGreaterThan(0);
    expect(vistos.armas).toBeGreaterThan(0);
    expect(vistos.remates).toBeGreaterThan(0);
  }, 30_000);
});
