/**
 * Puesta en escena: suelo, actores y adornos. El personaje lo monta el rig de
 * `art/pixiRig.ts`; aqui solo se coloca y se le cuelga la barra de vida.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { getWeapon } from '@camorra/engine';
import { colorOf, GROSOR, MASCOTAS, PALETA, TRAZO, type WeaponCategory } from './art/parts.js';
import { buildRig, setWeapon, type Rig } from './art/pixiRig.js';
import type { Actor } from './fightScene.js';

export const SIZE = { width: 900, height: 420 };

/** Categoria y alcance del arma. Los punos y los bichos no llevan nada. */
export function weaponOf(id: string): { category: WeaponCategory; reach: number } | undefined {
  if (id === 'punos' || id.startsWith('pet:')) return undefined;
  const weapon = getWeapon(id);
  return { category: weapon.category, reach: weapon.reach };
}

export interface ActorView {
  root: Container;
  /** Lo que se voltea, se tine y se apaga. */
  body: Container;
  /** Solo los luchadores tienen rig; las mascotas van de una pieza. */
  rig: Rig | null;
  hpFill: Graphics;
  actor: Actor;
}

function drawPet(petId: string): Container {
  const container = new Container();
  const shapes = MASCOTAS[petId] ?? MASCOTAS['chucho'] ?? [];
  const colors = {
    piel: PALETA.piel[2] ?? '#c68a5e',
    pelo: PALETA.pelo[1] ?? '#5b3a22',
    ropa: '#000',
  };
  const svg = shapes
    .map(
      (shape) =>
        `<path d="${shape.d}" fill="${colorOf(shape.fill, colors)}"` +
        (shape.stroke === false
          ? ' stroke="none"'
          : ` stroke="${TRAZO}" stroke-width="${GROSOR}" stroke-linejoin="round"`) +
        ' />',
    )
    .join('');
  container.addChild(new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`));
  return container;
}

export function drawActor(actor: Actor): ActorView {
  const root = new Container();
  root.x = actor.home.x * SIZE.width;
  root.y = actor.home.y * SIZE.height;

  const body = new Container();
  body.scale.x = actor.facing;

  let rig: Rig | null = null;
  if (actor.appearance !== null) {
    rig = buildRig(actor.appearance, weaponOf(actor.weapon));
    body.addChild(rig.root);
  } else {
    body.addChild(drawPet(actor.petId ?? 'chucho'));
  }

  const alto = actor.isPet ? 34 : 118;
  const hpWidth = actor.isPet ? 34 : 60;

  const hpFondo = new Graphics()
    .roundRect(0, 0, hpWidth, 6, 3)
    .fill({ color: 0x000000, alpha: 0.22 });
  hpFondo.x = -hpWidth / 2;
  hpFondo.y = -alto - 16;

  const hpFill = new Graphics().roundRect(0, 0, hpWidth, 6, 3).fill(0x44aa77);
  hpFill.x = -hpWidth / 2;
  hpFill.y = -alto - 16;

  const nombre = new Text({
    text: actor.name,
    style: { fontFamily: 'system-ui', fontSize: actor.isPet ? 11 : 14, fill: 0x333333 },
  });
  nombre.anchor.set(0.5);
  nombre.y = -alto - 30;

  root.addChild(body, hpFondo, hpFill, nombre);
  return { root, body, rig, hpFill, actor };
}

export function changeWeapon(view: ActorView, weaponId: string): void {
  if (view.rig !== null) setWeapon(view.rig, weaponOf(weaponId));
}

export function drawGround(): Graphics {
  return new Graphics()
    .moveTo(0, SIZE.height * 0.83)
    .lineTo(SIZE.width, SIZE.height * 0.83)
    .stroke({ width: 3, color: 0xd8d4cc });
}

export function makeFloater(text: string, color: number): Text {
  const label = new Text({
    text,
    style: { fontFamily: 'system-ui', fontSize: 20, fontWeight: 'bold', fill: color },
  });
  label.anchor.set(0.5);
  return label;
}

export const makeRing = (color: number): Graphics =>
  new Graphics().circle(0, 0, 30).stroke({ width: 3, color });

export const makeProjectile = (): Graphics =>
  new Graphics().circle(0, 0, 7).fill(PALETA.metal).stroke({ width: 2, color: TRAZO });
