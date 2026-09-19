/**
 * Puesta en escena: suelo, actores y adornos. El personaje lo monta el rig de
 * `art/pixiRig.ts`; aqui solo se coloca y se le cuelga la barra de vida.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { getWeapon } from '@camorra/engine';
import { aEntero, BORDE, LIENZO, RADIO } from '@camorra/shared';
import { colorOf, GROSOR, MASCOTAS, PALETA, TRAZO, type WeaponCategory } from './art/parts.js';
import { ESCENARIOS } from './art/escenarios.js';
import { buildRig, setWeapon, type Rig } from './art/pixiRig.js';
import type { Actor } from './fightScene.js';

export const SIZE = { width: 900, height: 420 };

/**
 * Cuanto se agranda al peleon dentro del lienzo. El rig mide ~128 px: a escala
 * 1 ocupaba el 30% del alto y dejaba medio cuadro de color plano encima. A 1.45
 * llena cerca del 45%, que es lo que hace un juego de pelea.
 *
 * Solo escala a los actores. El decorado sigue en coordenadas del lienzo, asi
 * que los escenarios no se tocan.
 */
export const ESCALA_ACTOR = 1.45;

/** El horizonte, en coordenadas del lienzo. Los escenarios lo dan por sabido. */
export const SUELO = Math.round(SIZE.height * 0.83);

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

// El margen deja libre el marco (14 px) y algo de aire por dentro.
const HUD = { margen: 38, ancho: 310, alto: 18, arriba: 30 } as const;

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
export function makeAnnounce(text: string, grande: boolean): Container {
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

  // Los dos carteles caen sobre lo que haya pintado el escenario: sin placa
  // detras, el texto oscuro se pierde en un fondo oscuro.
  const grupo = new Container();
  const ancho = label.width + 56;
  const alto = label.height + 28;
  const placa = new Graphics()
    .roundRect(-ancho / 2, -alto / 2, ancho, alto, RADIO)
    .fill({ color: aEntero(LIENZO.fondo), alpha: 0.94 })
    .stroke({ width: BORDE * 2, color: TRAZO });

  // Dos clavos a los lados, para que no sea una caja sin mas.
  for (const lado of [-1, 1]) {
    placa
      .circle((lado * ancho) / 2 - lado * 13, 0, 3)
      .fill({ color: TRAZO, alpha: 0.75 });
  }
  grupo.addChild(placa, label);
  grupo.x = SIZE.width / 2;
  grupo.y = SIZE.height * 0.42;
  return grupo;
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
  body.scale.set(actor.facing * ESCALA_ACTOR, ESCALA_ACTOR);

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

/** El fondo, detras de todo. Una sola Graphics: es decorado, no cambia nunca. */
export function drawEscenario(indice: number): Graphics {
  const escenario = ESCENARIOS[indice % ESCENARIOS.length];
  const g = new Graphics();
  if (escenario === undefined) return g;

  for (const pieza of escenario.piezas) {
    g.svg(
      `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pieza.d}" fill="${pieza.color}"${
        pieza.trazo === undefined
          ? ''
          : ` stroke="${pieza.trazo.color}" stroke-width="${pieza.trazo.grosor}" stroke-linecap="round"`
      } /></svg>`,
    );
  }
  return g;
}

/** La linea del horizonte, en trazo oscuro: separa el fondo del suelo. */
export function drawGround(): Graphics {
  return new Graphics()
    .moveTo(0, SUELO)
    .lineTo(SIZE.width, SUELO)
    .stroke({ width: 3, color: TRAZO, alpha: 0.55 });
}

/** Grosor del marco. Lo que quede dentro de esta franja lo tapa el marco. */
export const MARCO = 14;

/**
 * Marco de cartel, no un rectangulo: doble filete, esquinas en escuadra y un
 * rombo en cada una. Va dentro del lienzo y por encima de todo, asi que
 * tambien recorta el decorado que se acerque demasiado al borde.
 */
export function drawFrame(): Graphics {
  const { width: w, height: h } = SIZE;
  const g = new Graphics();

  // Banda de madera pegada al borde, con el filete grueso por fuera.
  g.rect(0, 0, w, h).stroke({ width: MARCO, color: aEntero(LIENZO.suelo) });
  g.rect(0, 0, w, h).stroke({ width: 4, color: TRAZO });
  // Filete fino por dentro, que es lo que le da el aire de cartel.
  g.rect(MARCO, MARCO, w - MARCO * 2, h - MARCO * 2).stroke({ width: 2, color: TRAZO });

  const brazo = 26;
  for (const [ex, ey] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const x = ex === 0 ? MARCO : w - MARCO;
    const y = ey === 0 ? MARCO : h - MARCO;
    const sx = ex === 0 ? 1 : -1;
    const sy = ey === 0 ? 1 : -1;

    // Escuadra: dos trazos cortos siguiendo el filete interior.
    g.moveTo(x + sx * brazo, y)
      .lineTo(x, y)
      .lineTo(x, y + sy * brazo)
      .stroke({ width: 5, color: TRAZO });

    // Rombo en el vertice.
    const r = 7;
    g.moveTo(x, y - r)
      .lineTo(x + r, y)
      .lineTo(x, y + r)
      .lineTo(x - r, y)
      .closePath()
      .fill(aEntero(LIENZO.fondo))
      .stroke({ width: 3, color: TRAZO });
  }
  return g;
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
