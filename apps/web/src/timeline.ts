/**
 * Del guion (`fightScene.ts`) a una linea de tiempo de GSAP sobre el rig de Pixi.
 *
 * Todo lo que se anima se crea antes de reproducir: si se crearan objetos sobre
 * la marcha, saltar al final o repetir dejaria la escena a medias.
 */
import { gsap } from 'gsap';
import type { Container } from 'pixi.js';
import { RIG, type PartName } from './art/parts.js';
import { ANIMATIONS, type AnimName } from './art/poses.js';
import type { Move, Scene } from './fightScene.js';
import {
  changeWeapon,
  drawActor,
  drawGround,
  drawHud,
  makeAnnounce,
  makeFloater,
  makeProjectile,
  makeRing,
  SIZE,
  weaponOf,
  type ActorView,
} from './pixiScene.js';

const BLANCO = 0xffffff;

/** Medio cuerpo de cada uno. El rig mide unos 50 px de ancho. */
const MEDIO_CUERPO = 26;

/**
 * A que distancia del rival se planta quien ataca. Con punos se acercan hasta
 * casi tocarse; con un chuzo se quedan a un par de cuerpos, que para eso tiene
 * alcance (COMBATE.md §1.5).
 */
function hueco(weaponId: string): number {
  const alcance = weaponOf(weaponId)?.reach ?? 1;
  return MEDIO_CUERPO * 2 + alcance * 12;
}

/**
 * Envoltorio de `fromTo` que fuerza `immediateRender: false`. NO usar
 * `timeline.fromTo` directamente.
 *
 * Por defecto GSAP aplica los valores de inicio al CREAR el tween, no cuando le
 * toca sonar. Como la linea de tiempo se construye entera de golpe, sin esto los
 * numeros de dano, los anillos y los proyectiles aparecen visibles desde el
 * primer fotograma y se quedan ahi quietos hasta su turno.
 */
function fromTo(
  linea: gsap.core.Timeline,
  objetivo: object,
  desde: gsap.TweenVars,
  hasta: gsap.TweenVars,
  at: number,
): void {
  linea.fromTo(objetivo, desde, { ...hasta, immediateRender: false }, at);
}

/** Posicion de reposo de cada articulacion, para sumarle los desplazamientos. */
const BASE = new Map<PartName, { x: number; y: number }>(
  RIG.map((part) => [part.name, { x: part.at[0], y: part.at[1] }]),
);

/**
 * Toca una animacion del rig estirando sus keyframes a lo que dure el evento.
 * Las mascotas no tienen rig: se les hace un gesto equivalente de una pieza.
 */
function playAnimation(
  tl: gsap.core.Timeline,
  view: ActorView,
  anim: AnimName,
  at: number,
  duration: number,
): void {
  if (view.rig === null) return playFallback(tl, view, anim, at, duration);

  const { frames } = ANIMATIONS[anim];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame === undefined) continue;
    const previo = i === 0 ? undefined : frames[i - 1];
    const desde = at + (previo?.t ?? 0) * duration;
    const tramo = i === 0 ? 0 : (frame.t - (previo?.t ?? 0)) * duration;

    for (const [name, pose] of Object.entries(frame.parts)) {
      const node = view.rig.parts.get(name as PartName);
      const base = BASE.get(name as PartName);
      if (node === undefined || base === undefined) continue;

      const destino: Record<string, number> = {};
      if (pose.rot !== undefined) destino['rotation'] = pose.rot;
      if (pose.x !== undefined) destino['x'] = base.x + pose.x;
      if (pose.y !== undefined) destino['y'] = base.y + pose.y;
      if (Object.keys(destino).length === 0) continue;

      // El primer frame se fija de golpe: es el punto de partida del gesto.
      if (tramo === 0) tl.set(node, destino, desde);
      else tl.to(node, { ...destino, duration: tramo, ease: 'power1.inOut' }, desde);
    }
  }
}

/** Gesto minimo para quien no tiene articulaciones. */
function playFallback(
  tl: gsap.core.Timeline,
  view: ActorView,
  anim: AnimName,
  at: number,
  duration: number,
): void {
  const { body, actor } = view;
  const mitad = duration / 2;

  if (anim === 'hit') {
    tl.to(body, { x: actor.facing * -10, duration: mitad, ease: 'power3.out' }, at);
    tl.to(body, { x: 0, duration: mitad, ease: 'elastic.out(1, 0.4)' }, at + mitad);
  } else if (anim === 'evade') {
    tl.to(body, { y: -16, duration: mitad, ease: 'power2.out' }, at);
    tl.to(body, { y: 0, duration: mitad, ease: 'power2.in' }, at + mitad);
  } else if (anim === 'death') {
    tl.to(body, { rotation: actor.facing * 1.4, duration, ease: 'power2.in' }, at);
  } else if (anim.startsWith('attack')) {
    tl.to(body, { x: actor.facing * 12, duration: mitad, ease: 'power2.in' }, at);
    tl.to(body, { x: 0, duration: mitad, ease: 'power1.out' }, at + mitad);
  } else {
    tl.to(body.scale, { y: 1.06, duration: mitad }, at);
    tl.to(body.scale, { y: 1, duration: mitad }, at + mitad);
  }
}

function addMove(
  tl: gsap.core.Timeline,
  views: Map<string, ActorView>,
  stage: Container,
  move: Move,
  at: number,
  duration: number,
): void {
  // El cartel no es de nadie: se pinta en medio de la pantalla.
  if (move.kind === 'announce') {
    const label = makeAnnounce(move.text, move.grande);
    label.alpha = 0;
    stage.addChild(label);
    fromTo(
      tl,
      label.scale,
      { x: 0.6, y: 0.6 },
      { x: 1, y: 1, duration: duration * 0.45, ease: 'back.out(2)' },
      at,
    );
    fromTo(tl, label, { alpha: 0 }, { alpha: 1, duration: duration * 0.25 }, at);
    tl.to(label, { alpha: 0, duration: duration * 0.3 }, at + duration * 0.7);
    return;
  }

  const view = views.get(move.kind === 'projectile' ? move.from : move.id);
  if (view === undefined) return;
  const { root, body } = view;
  const homeX = view.actor.home.x * SIZE.width;
  const homeY = view.actor.home.y * SIZE.height;
  const mitad = duration / 2;

  switch (move.kind) {
    case 'appear':
      fromTo(tl, root, { alpha: 0, y: homeY - 40 }, { alpha: 1, y: homeY, duration }, at);
      break;

    case 'approach':
    case 'lunge': {
      const target = views.get(move.toward);
      if (target === undefined) return;
      const targetX = target.actor.home.x * SIZE.width;
      const hacia = targetX > homeX ? 1 : -1;
      const contacto = targetX - hacia * hueco(move.weapon);

      if (move.kind === 'approach') {
        // Se acerca y SE QUEDA: el golpe sale de ahi, no de su sitio de espera.
        tl.to(root, { x: contacto, duration, ease: 'power2.out' }, at);
      } else {
        // Con arma larga no hubo acercamiento previo, asi que este tramo lo cubre.
        tl.to(root, { x: contacto, duration: mitad, ease: 'power2.in' }, at);
        tl.to(root, { x: homeX, duration: mitad, ease: 'power1.out' }, at + mitad);
      }
      break;
    }

    case 'pose':
      playAnimation(tl, view, move.anim, at, duration);
      break;

    case 'flash':
      // `set` en vez de tween: interpolar un color como entero da colores falsos.
      tl.set(body, { tint: move.color }, at);
      tl.set(body, { tint: BLANCO }, at + duration * 0.6);
      break;

    case 'pulse':
      tl.to(body.scale, { y: 1.05, duration: mitad }, at);
      tl.to(body.scale, { y: 1, duration: mitad }, at + mitad);
      break;

    case 'hp':
      tl.to(
        view.hpFill.scale,
        { x: Math.max(0, move.hp / view.actor.maxHp), duration, ease: 'power1.out' },
        at,
      );
      break;

    case 'float': {
      const label = makeFloater(move.text, move.color);
      label.x = homeX;
      label.y = homeY - 130;
      label.alpha = 0;
      stage.addChild(label);
      fromTo(tl, label, { alpha: 1, y: homeY - 130 }, { alpha: 0, y: homeY - 180, duration }, at);
      break;
    }

    case 'weapon':
      // Cambiar la forma no se puede interpolar: se hace de golpe y se marca con un salto.
      tl.call(() => changeWeapon(view, move.weapon), undefined, at);
      fromTo(tl, body.scale, { y: 0.94 }, { y: 1, duration, ease: 'back.out(2)' }, at);
      break;

    case 'projectile': {
      const target = views.get(move.to);
      if (target === undefined) return;
      const bala = makeProjectile();
      bala.alpha = 0;
      stage.addChild(bala);
      fromTo(
        tl,
        bala,
        { alpha: 1, x: homeX, y: homeY - 70 },
        {
          x: target.actor.home.x * SIZE.width,
          y: target.actor.home.y * SIZE.height - 70,
          rotation: 8,
          duration,
          ease: 'none',
        },
        at,
      );
      tl.set(bala, { alpha: 0 }, at + duration);
      break;
    }

    case 'toss': {
      const perdida = makeProjectile();
      perdida.alpha = 0;
      stage.addChild(perdida);
      tl.call(() => changeWeapon(view, 'punos'), undefined, at);
      fromTo(
        tl,
        perdida,
        { alpha: 1, x: homeX, y: homeY - 70 },
        {
          x: homeX - view.actor.facing * 80,
          y: homeY - 5,
          rotation: 12,
          duration,
          ease: 'power1.in',
        },
        at,
      );
      break;
    }

    case 'ring': {
      const anillo = makeRing(move.color);
      anillo.x = homeX;
      anillo.y = homeY - 60;
      anillo.alpha = 0;
      stage.addChild(anillo);
      fromTo(tl, anillo, { alpha: 0.9 }, { alpha: 0, duration, ease: 'power1.out' }, at);
      fromTo(tl, anillo.scale, { x: 0.3, y: 0.3 }, { x: 1.7, y: 1.7, duration }, at);
      break;
    }

    case 'fall':
      tl.to(root, { alpha: 0.4, duration }, at);
      break;
  }
}

export function buildTimeline(
  stage: Container,
  scene: Scene,
  onCaption: (text: string | null) => void,
): gsap.core.Timeline {
  stage.addChild(drawGround());

  const brutoA = scene.actors.find((a) => a.id === 'A');
  const brutoB = scene.actors.find((a) => a.id === 'B');
  const hud = drawHud(brutoA?.name ?? 'A', brutoB?.name ?? 'B');

  const views = new Map<string, ActorView>();
  for (const actor of scene.actors) {
    const barra = actor.id === 'A' ? hud.fillA : actor.id === 'B' ? hud.fillB : undefined;
    const view = drawActor(actor, barra);
    view.root.alpha = 0;
    stage.addChild(view.root);
    views.set(actor.id, view);
  }
  // El marcador, por encima de todo lo demas.
  stage.addChild(hud.root);

  const timeline = gsap.timeline();
  for (const beat of scene.beats) {
    const caption = beat.caption;
    // Al saltar o repetir, GSAP vuelve a disparar estas llamadas: el pie sigue al dia.
    if (caption !== null) timeline.call(() => onCaption(caption), undefined, beat.at);
    for (const move of beat.moves) addMove(timeline, views, stage, move, beat.at, beat.duration);
  }

  return timeline;
}
