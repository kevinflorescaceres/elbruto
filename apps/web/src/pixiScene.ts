/**
 * Puesta en escena: suelo, actores y adornos. El personaje lo monta el rig de
 * `art/pixiRig.ts`; aqui solo se coloca y se le cuelga la barra de vida.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { getWeapon } from '@camorra/engine';
import { aEntero, LIENZO } from '@camorra/shared';
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

/** Marcador superior: dos barras enfrentadas, al estilo de los juegos de pelea. */
export interface Hud {
  root: Container;
  fillA: Graphics;
  fillB: Graphics;
}

const HUD = { margen: 24, ancho: 330, alto: 18, arriba: 22 } as const;

export function drawHud(nombreA: string, nombreB: string): Hud {
  const root = new Container();

  const lado = (izquierda: boolean, nombre: string): Graphics => {
    const x = izquierda ? HUD.margen : SIZE.width - HUD.margen;
    const signo = izquierda ? 1 : -1;

    const marco = new Graphics()
      .roundRect(Math.min(x, x + signo * HUD.ancho), HUD.arriba, HUD.ancho, HUD.alto, 4)
      .fill({ color: 0x000000, alpha: 0.28 })
      .stroke({ width: 2, color: TRAZO });
    root.addChild(marco);

    // La barra se vacia hacia AFUERA: el borde interior es el que retrocede.
    const fill = new Graphics().roundRect(0, 0, HUD.ancho, HUD.alto, 4).fill(aEntero(LIENZO.vida));
    fill.x = izquierda ? x : x - HUD.ancho;
    fill.y = HUD.arriba;
    fill.pivot.x = izquierda ? 0 : HUD.ancho;
    if (!izquierda) fill.x = x;
    root.addChild(fill);

    const texto = new Text({
      text: nombre,
      style: { fontFamily: 'system-ui', fontSize: 15, fontWeight: 'bold', fill: 0x2a2a2a },
    });
    texto.anchor.set(izquierda ? 0 : 1, 0);
    texto.x = x;
    texto.y = HUD.arriba + HUD.alto + 5;
    root.addChild(texto);

    return fill;
  };

  const fillA = lado(true, nombreA);
  const fillB = lado(false, nombreB);
  return { root, fillA, fillB };
}

/** Cartel grande de apertura y de cierre. */
export function makeAnnounce(text: string, grande: boolean): Text {
  const label = new Text({
    text,
    style: {
      fontFamily: 'Alegreya, Georgia, serif',
      fontSize: grande ? 54 : 40,
      fontWeight: 'bold',
      fill: 0x2a2a2a,
      align: 'center',
    },
  });
  label.anchor.set(0.5);
  label.x = SIZE.width / 2;
  label.y = SIZE.height * 0.42;
  return label;
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
    ropa: '#000000',
    ropa2: '#000000',
  };
  const svg = shapes
    .map(
      (shape) =>
        `<path d="${shape.d}" fill="${shape.trazo === undefined ? colorOf(shape.fill, colors) : 'none'}"` +
        (shape.stroke === false
          ? ' stroke="none"'
          : ` stroke="${shape.trazo === undefined ? TRAZO : colorOf(shape.fill, colors)}"` +
            ` stroke-width="${shape.trazo ?? GROSOR}" stroke-linejoin="round" stroke-linecap="round"`) +
        ' />',
    )
    .join('');
  container.addChild(new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`));
  return container;
}

export function drawActor(actor: Actor, hudFill?: Graphics): ActorView {
  const root = new Container();
  root.x = actor.home.x * SIZE.width;
  root.y = actor.home.y * SIZE.height;

  const body = new Container();
  body.scale.x = actor.facing;

  let rig: Rig | null = null;
  if (actor.appearance !== null) {
    rig = buildRig(actor.appearance, actor.slug, weaponOf(actor.weapon));
    body.addChild(rig.root);
  } else {
    body.addChild(drawPet(actor.petId ?? 'chucho'));
  }

  root.addChild(body);

  // El luchador usa la barra del marcador. La mascota lleva la suya encima,
  // que es secundaria y conviene verla junto al bicho.
  if (hudFill !== undefined) return { root, body, rig, hpFill: hudFill, actor };

  const alto = 34;
  const hpWidth = 34;
  const hpFondo = new Graphics()
    .roundRect(0, 0, hpWidth, 5, 3)
    .fill({ color: 0x000000, alpha: 0.22 });
  hpFondo.x = -hpWidth / 2;
  hpFondo.y = -alto - 14;

  const hpFill = new Graphics().roundRect(0, 0, hpWidth, 5, 3).fill(aEntero(LIENZO.vida));
  hpFill.x = -hpWidth / 2;
  hpFill.y = -alto - 14;

  const nombre = new Text({
    text: actor.name,
    style: { fontFamily: 'system-ui', fontSize: 11, fill: 0x555555 },
  });
  nombre.anchor.set(0.5);
  nombre.y = -alto - 28;

  root.addChild(hpFondo, hpFill, nombre);
  return { root, body, rig, hpFill, actor };
}

export function changeWeapon(view: ActorView, weaponId: string): void {
  if (view.rig !== null) setWeapon(view.rig, weaponOf(weaponId));
}

export function drawGround(): Graphics {
  return new Graphics()
    .moveTo(0, SIZE.height * 0.83)
    .lineTo(SIZE.width, SIZE.height * 0.83)
    .stroke({ width: 3, color: aEntero(LIENZO.suelo) });
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
