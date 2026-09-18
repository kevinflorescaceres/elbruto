/**
 * Dibujo de la escena con PixiJS. Formas geometricas simples: en la fase 5 se
 * sustituyen por el rig de partes SVG sin tocar el guion (`fightScene.ts`) ni la
 * linea de tiempo (`FightPlayer.tsx`).
 */
import { Container, Graphics, Text } from 'pixi.js';
import type { Actor } from './fightScene.js';

export const SIZE = { width: 900, height: 420 };

const PALETA = {
  fondoA: 0x8a5a3c,
  fondoB: 0x4a6a8a,
  piel: 0xe8c39e,
  suelo: 0xd8d4cc,
  arma: 0x6b6b6b,
  barra: 0x44aa77,
  barraFondo: 0x000000,
} as const;

/** Cada combatiente es un contenedor con cuerpo, cabeza, arma y barra de vida. */
export interface ActorView {
  root: Container;
  /** Solo el cuerpo: se sacude y gira sin arrastrar la barra de vida. */
  body: Container;
  weapon: Graphics;
  hpFill: Graphics;
  hpWidth: number;
  actor: Actor;
}

export function drawActor(actor: Actor): ActorView {
  const root = new Container();
  root.x = actor.home.x * SIZE.width;
  root.y = actor.home.y * SIZE.height;

  const escala = actor.isPet ? 0.55 : 1;
  const color = actor.side === 'A' ? PALETA.fondoA : PALETA.fondoB;
  const alto = 70 * escala;
  const ancho = 30 * escala;

  const body = new Container();
  body.scale.x = actor.facing;

  const torso = new Graphics()
    .roundRect(-ancho / 2, -alto, ancho, alto, 6 * escala)
    .fill(color)
    .stroke({ width: 3, color: 0x2a2a2a });

  const cabeza = new Graphics()
    .circle(0, -alto - 14 * escala, 14 * escala)
    .fill(PALETA.piel)
    .stroke({ width: 3, color: 0x2a2a2a });

  // El arma cuelga de la mano: girarla desde ahi basta para el gesto de golpe.
  const weapon = new Graphics()
    .roundRect(0, -3 * escala, 34 * escala, 6 * escala, 3)
    .fill(PALETA.arma)
    .stroke({ width: 2, color: 0x2a2a2a });
  weapon.x = ancho / 2;
  weapon.y = -alto * 0.55;
  // Las mascotas muerden: no llevan arma.
  weapon.visible = !actor.isPet && actor.weapon !== 'punos';

  body.addChild(torso, cabeza, weapon);

  const hpWidth = 56 * escala;
  const hpFondo = new Graphics()
    .roundRect(-hpWidth / 2, -alto - 34 * escala, hpWidth, 6, 3)
    .fill({ color: PALETA.barraFondo, alpha: 0.25 });
  // Dibujada desde su propio origen para que escalar en x la vacie por la derecha.
  const hpFill = new Graphics().roundRect(0, 0, hpWidth, 6, 3).fill(PALETA.barra);
  hpFill.x = -hpWidth / 2;
  hpFill.y = -alto - 34 * escala;

  const nombre = new Text({
    text: actor.name,
    style: { fontFamily: 'system-ui', fontSize: 13 * escala, fill: 0x333333 },
  });
  nombre.anchor.set(0.5);
  nombre.y = -alto - 48 * escala;

  root.addChild(body, hpFondo, hpFill, nombre);
  return { root, body, weapon, hpFill, hpWidth, actor };
}

export function drawGround(): Graphics {
  return new Graphics()
    .moveTo(0, SIZE.height * 0.82)
    .lineTo(SIZE.width, SIZE.height * 0.82)
    .stroke({ width: 3, color: PALETA.suelo });
}

/** Numero flotante de dano o curacion. */
export function makeFloater(text: string, color: number): Text {
  const label = new Text({
    text,
    style: { fontFamily: 'system-ui', fontSize: 20, fontWeight: 'bold', fill: color },
  });
  label.anchor.set(0.5);
  return label;
}

export function makeRing(color: number): Graphics {
  return new Graphics().circle(0, 0, 30).stroke({ width: 3, color });
}

export function makeProjectile(): Graphics {
  return new Graphics().circle(0, 0, 7).fill(PALETA.arma).stroke({ width: 2, color: 0x2a2a2a });
}
