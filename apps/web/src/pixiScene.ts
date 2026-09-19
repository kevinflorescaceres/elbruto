/**
 * Puesta en escena: suelo, actores y adornos. El personaje lo monta el rig de
 * `art/pixiRig.ts`; aqui solo se coloca y se le cuelga la barra de vida.
 */
import { Container, Graphics, Text } from 'pixi.js';
import { getWeapon } from '@camorra/engine';
import { aEntero, LIENZO, RADIO } from '@camorra/shared';
import { colorOf, GROSOR, MASCOTAS, PALETA, TRAZO, type WeaponCategory } from './art/parts.js';
import { ESCENARIOS } from './art/escenarios.js';
import { buildRig, setWeapon, type Rig } from './art/pixiRig.js';
import type { Actor } from './fightScene.js';

export const SIZE = { width: 1440, height: 420 };

/**
 * Cuanto se agranda al peleon dentro del lienzo. El rig mide ~128 px: a escala
 * 1 ocupaba el 30% del alto y dejaba medio cuadro de color plano encima.
 *
 * A 1.75 mide 224 px, algo mas de la mitad del alto. El numero va atado al
 * ancho del lienzo: al pasar de 900 a 1440 unidades, la misma pantalla reparte
 * menos pixeles por unidad y con 1.45 los peleones volvian a verse pequenos.
 */
export const ESCALA_ACTOR = 1.75;

/** El horizonte, en coordenadas del lienzo. Los escenarios lo dan por sabido. */
export const SUELO = Math.round(SIZE.height * 0.83);

/** Categoria y alcance del arma. Los punos y los bichos no llevan nada. */
export function weaponOf(id: string): { category: WeaponCategory; reach: number } | undefined {
  if (id === 'punos' || id.startsWith('pet:')) return undefined;
  const weapon = getWeapon(id);
  return { category: weapon.category, reach: weapon.reach };
}

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

  const grupo = new Container();
  const w = label.width + 92;
  const h = label.height + 44;
  const x0 = -w / 2;
  const y0 = -h / 2;

  const placa = new Graphics();
  // Sombra dura, para que el cartel se despegue del escenario.
  placa.roundRect(x0 + 6, y0 + 7, w, h, RADIO).fill({ color: 0x000000, alpha: 0.28 });
  // Cuerpo del cartel y filete grueso por fuera.
  placa
    .roundRect(x0, y0, w, h, RADIO)
    .fill({ color: aEntero(LIENZO.fondo), alpha: 0.96 })
    .stroke({ width: 4, color: TRAZO });
  // Filete fino por dentro: es lo que le da el aire de cartel impreso.
  placa.rect(x0 + 9, y0 + 9, w - 18, h - 18).stroke({ width: 2, color: TRAZO });

  // Escuadras y rombo en cada esquina del filete interior.
  const brazo = 16;
  for (const [ex, ey] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const x = ex === 0 ? x0 + 9 : x0 + w - 9;
    const y = ey === 0 ? y0 + 9 : y0 + h - 9;
    const sx = ex === 0 ? 1 : -1;
    const sy = ey === 0 ? 1 : -1;

    placa
      .moveTo(x + sx * brazo, y)
      .lineTo(x, y)
      .lineTo(x, y + sy * brazo)
      .stroke({ width: 4, color: TRAZO });

    const r = 5;
    placa
      .moveTo(x, y - r)
      .lineTo(x + r, y)
      .lineTo(x, y + r)
      .lineTo(x - r, y)
      .closePath()
      .fill(TRAZO);
  }

  // Un rombo suelto a cada lado del texto, como remate.
  for (const lado of [-1, 1]) {
    const cx = (lado * (label.width + 44)) / 2;
    const r = 6;
    placa
      .moveTo(cx, -r)
      .lineTo(cx + r, 0)
      .lineTo(cx, r)
      .lineTo(cx - r, 0)
      .closePath()
      .fill({ color: TRAZO, alpha: 0.8 });
  }

  grupo.addChild(placa, label);
  grupo.x = SIZE.width / 2;
  // Arriba del todo: el marcador se fue al DOM y dejo libre esa franja, asi que
  // el cartel ya no tiene que caer sobre la cara de los peleones (que llegan a
  // y = 133).
  grupo.y = SIZE.height * 0.22;
  return grupo;
}

export interface ActorView {
  root: Container;
  /** Lo que se voltea, se tine y se apaga. */
  body: Container;
  /** Solo los luchadores tienen rig; las mascotas van de una pieza. */
  rig: Rig | null;
  /** La barra propia del bicho. Los peleones usan la del marcador, en HTML. */
  hpFill: Graphics | null;
  /** La barra del marcador, para los peleones. La pone `buildTimeline`. */
  hpDom: HTMLElement | null;
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

export function drawActor(actor: Actor): ActorView {
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

  // El luchador usa la barra del marcador, que va en HTML. La mascota lleva la
  // suya encima, que es secundaria y conviene verla junto al bicho.
  if (actor.appearance !== null) return { root, body, rig, hpFill: null, hpDom: null, actor };

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
  return { root, body, rig, hpFill, hpDom: null, actor };
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
