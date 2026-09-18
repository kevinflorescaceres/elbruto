/**
 * Del guion (`fightScene.ts`) a una linea de tiempo de GSAP sobre objetos Pixi.
 *
 * Todo lo que se anima se crea aqui, antes de reproducir: si se crearan objetos
 * sobre la marcha, saltar al final o repetir dejaria la escena a medias.
 */
import { gsap } from 'gsap';
import type { Container } from 'pixi.js';
import { getWeapon } from '@rufianes/engine';
import type { Move, Scene } from './fightScene.js';
import {
  drawActor,
  drawGround,
  makeFloater,
  makeProjectile,
  makeRing,
  SIZE,
  type ActorView,
} from './pixiScene.js';

const BLANCO = 0xffffff;

/** Largo del arma segun su alcance. Las mascotas y los punos no pintan arma. */
function weaponScale(id: string): number {
  if (id === 'punos' || id.startsWith('pet:')) return 0;
  return 0.6 + getWeapon(id).reach * 0.22;
}

function addMove(
  tl: gsap.core.Timeline,
  views: Map<string, ActorView>,
  stage: Container,
  move: Move,
  at: number,
  duration: number,
): void {
  const view = views.get('id' in move ? move.id : move.from);
  if (view === undefined) return;
  const { root, body, weapon } = view;
  const homeX = view.actor.home.x * SIZE.width;
  const homeY = view.actor.home.y * SIZE.height;
  const mitad = duration / 2;

  switch (move.kind) {
    case 'appear':
      tl.fromTo(root, { alpha: 0, y: homeY - 40 }, { alpha: 1, y: homeY, duration }, at);
      break;

    case 'approach':
    case 'lunge': {
      const target = views.get(move.toward);
      if (target === undefined) return;
      const targetX = target.actor.home.x * SIZE.width;
      const cerca = move.kind === 'lunge' ? 0.34 : 0.22;
      tl.to(root, { x: homeX + (targetX - homeX) * cerca, duration: mitad, ease: 'power2.in' }, at);
      tl.to(root, { x: homeX, duration: mitad, ease: 'power1.out' }, at + mitad);
      if (move.kind === 'lunge') {
        tl.to(weapon, { rotation: -1.1, duration: mitad, ease: 'power2.in' }, at);
        tl.to(weapon, { rotation: 0, duration: mitad, ease: 'power1.out' }, at + mitad);
      }
      break;
    }

    case 'shake': {
      const empuje = view.actor.facing * -14;
      tl.to(body, { x: empuje, duration: duration * 0.35, ease: 'power3.out' }, at);
      tl.to(
        body,
        { x: 0, duration: duration * 0.65, ease: 'elastic.out(1, 0.4)' },
        at + duration * 0.35,
      );
      break;
    }

    case 'hop':
      tl.to(
        root,
        { y: homeY - 26, x: homeX - view.actor.facing * 18, duration: mitad, ease: 'power2.out' },
        at,
      );
      tl.to(root, { y: homeY, x: homeX, duration: mitad, ease: 'power2.in' }, at + mitad);
      break;

    case 'flash':
      // `set` en vez de tween: interpolar un color como entero da colores falsos.
      tl.set(body, { tint: move.color }, at);
      tl.set(body, { tint: BLANCO }, at + duration * 0.6);
      break;

    case 'pulse':
      tl.to(body.scale, { x: view.actor.facing * 1.06, y: 1.06, duration: mitad }, at);
      tl.to(body.scale, { x: view.actor.facing, y: 1, duration: mitad }, at + mitad);
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
      label.y = homeY - 90;
      label.alpha = 0;
      stage.addChild(label);
      tl.fromTo(label, { alpha: 1, y: homeY - 90 }, { alpha: 0, y: homeY - 140, duration }, at);
      break;
    }

    case 'weapon': {
      const escala = weaponScale(move.weapon);
      tl.set(weapon, { visible: escala > 0 }, at);
      tl.fromTo(
        weapon.scale,
        { x: 0.2, y: 0.6 },
        { x: escala, y: 1, duration, ease: 'back.out(2)' },
        at,
      );
      break;
    }

    case 'projectile': {
      const target = views.get(move.to);
      if (target === undefined) return;
      const bala = makeProjectile();
      bala.alpha = 0;
      stage.addChild(bala);
      tl.fromTo(
        bala,
        { alpha: 1, x: homeX, y: homeY - 40 },
        {
          x: target.actor.home.x * SIZE.width,
          y: target.actor.home.y * SIZE.height - 40,
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
      tl.fromTo(
        perdida,
        { alpha: 1, x: homeX, y: homeY - 40 },
        {
          x: homeX + view.actor.facing * -70,
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
      anillo.y = homeY - 35;
      anillo.alpha = 0;
      stage.addChild(anillo);
      tl.fromTo(anillo, { alpha: 0.9 }, { alpha: 0, duration, ease: 'power1.out' }, at);
      tl.fromTo(anillo.scale, { x: 0.3, y: 0.3 }, { x: 1.6, y: 1.6, duration }, at);
      break;
    }

    case 'fall':
      tl.to(body, { rotation: view.actor.facing * 1.4, duration, ease: 'power2.in' }, at);
      tl.to(root, { alpha: 0.35, duration }, at);
      break;

    case 'cheer':
      tl.to(root, { y: homeY - 30, duration: duration * 0.25, ease: 'power2.out' }, at);
      tl.to(
        root,
        { y: homeY, duration: duration * 0.25, ease: 'bounce.out' },
        at + duration * 0.25,
      );
      tl.to(
        root,
        { y: homeY - 20, duration: duration * 0.25, ease: 'power2.out' },
        at + duration * 0.5,
      );
      tl.to(
        root,
        { y: homeY, duration: duration * 0.25, ease: 'bounce.out' },
        at + duration * 0.75,
      );
      break;
  }
}

export interface BuiltTimeline {
  timeline: gsap.core.Timeline;
  views: Map<string, ActorView>;
}

export function buildTimeline(
  stage: Container,
  scene: Scene,
  onCaption: (text: string | null) => void,
): BuiltTimeline {
  stage.addChild(drawGround());

  const views = new Map<string, ActorView>();
  for (const actor of scene.actors) {
    const view = drawActor(actor);
    view.root.alpha = 0;
    stage.addChild(view.root);
    views.set(actor.id, view);
  }

  const timeline = gsap.timeline();
  for (const beat of scene.beats) {
    const caption = beat.caption;
    // Al saltar o repetir, GSAP vuelve a disparar estas llamadas: el pie sigue al dia.
    if (caption !== null) timeline.call(() => onCaption(caption), undefined, beat.at);
    for (const move of beat.moves) addMove(timeline, views, stage, move, beat.at, beat.duration);
  }

  return { timeline, views };
}
