/**
 * El mismo peleon, montado como rig de contenedores Pixi. Cada parte es un
 * Container colocado en su articulacion: girarlo gira todo lo que cuelga.
 *
 * Comparte rutas y paleta con `Fighter.tsx` (PLAN.md fase 5).
 */
import { Container, Graphics } from 'pixi.js';
import type { Appearance } from '@camorra/engine';
import {
  colorOf,
  EXPRESIONES,
  GROSOR,
  lookFrom,
  PUNO,
  TRAZO,
  weaponShapes,
  Z_ORDER,
  type Expresion,
  type Look,
  type PartName,
  type Shape,
  type WeaponCategory,
} from './parts.js';
import { REST } from './poses.js';

function drawShapes(shapes: Shape[], colors: Look['colors']): Graphics {
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
  return new Graphics().svg(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
}

export interface Rig {
  root: Container;
  parts: Map<PartName, Container>;
  /** La mano derecha: aqui se cuelga y se cambia el arma. */
  hand: Container;
  colors: Look['colors'];
  /** Reposo de cada articulacion: las animaciones suman sus x/y sobre esto. */
  base: Map<PartName, { x: number; y: number }>;
  /**
   * Una Graphics por expresion, todas ya montadas en la cabeza y solo una a la
   * vista (`alpha` 1). Cambiar de cara es apagar una y encender otra: crearlas
   * sobre la marcha dejaria la escena a medias al saltar o repetir.
   */
  caras: Map<Expresion, Graphics>;
}

export function buildRig(
  appearance: Appearance,
  slug: string,
  weapon?: { category: WeaponCategory; reach: number },
): Rig {
  const look = lookFrom(appearance, slug);
  const parts = new Map<PartName, Container>();
  const caras = new Map<Expresion, Graphics>();
  const root = new Container();

  // Z_ORDER da la profundidad, y la forma propia de una parte usa la suya: asi
  // el brazo de atras queda detras del torso y el de delante por encima.
  const depth = (name: PartName): number => {
    const index = Z_ORDER.indexOf(name);
    return index === -1 ? Z_ORDER.indexOf('torso') : index;
  };

  for (const spec of look.rig) {
    const node = new Container();
    const pose = REST.parts[spec.name] ?? {};
    node.x = spec.at[0] + (pose.x ?? 0);
    node.y = spec.at[1] + (pose.y ?? 0);
    node.rotation = pose.rot ?? 0;
    node.zIndex = depth(spec.name);
    node.sortableChildren = true;

    // La cabeza va en capas para poder cambiarle la cara (ver `cabezaPorCapas`).
    const shapes = spec.name === 'head' ? undefined : look.parts[spec.name];
    if (spec.name === 'head') {
      const capas = [
        drawShapes(look.cabeza.debajo, look.colors),
        ...EXPRESIONES.map((e) => {
          const cara = drawShapes(look.cabeza.caras[e], look.colors);
          cara.alpha = e === 'neutral' ? 1 : 0;
          caras.set(e, cara);
          return cara;
        }),
        drawShapes(look.cabeza.encima, look.colors),
      ];
      // Todas a la misma profundidad: con `sortableChildren` el orden de alta
      // decide, y es el de pintado.
      for (const capa of capas) {
        capa.zIndex = depth(spec.name);
        node.addChild(capa);
      }
    } else if (shapes !== undefined) {
      const graphics = node.addChild(drawShapes(shapes, look.colors));
      graphics.zIndex = depth(spec.name);
    }

    parts.set(spec.name, node);
  }

  for (const spec of look.rig) {
    const node = parts.get(spec.name);
    if (node === undefined) continue;
    if (spec.parent === null) root.addChild(node);
    else parts.get(spec.parent)?.addChild(node);
  }

  const hand = new Container();
  hand.y = 16;
  hand.rotation = -0.35;
  hand.zIndex = Z_ORDER.length;
  parts.get('forearmFront')?.addChild(hand);

  const base = new Map(look.rig.map((spec) => [spec.name, { x: spec.at[0], y: spec.at[1] }]));
  const rig: Rig = { root, parts, hand, colors: look.colors, base, caras };
  setWeapon(rig, weapon);
  return rig;
}

/** Cambia el arma sin rehacer el rig. El puno se queda siempre debajo. */
export function setWeapon(
  rig: Rig,
  weapon: { category: WeaponCategory; reach: number } | undefined,
): void {
  rig.hand.removeChildren().forEach((child) => child.destroy());
  if (weapon !== undefined) {
    rig.hand.addChild(drawShapes(weaponShapes(weapon.category, weapon.reach), rig.colors));
  }
  rig.hand.addChild(drawShapes(PUNO, rig.colors));
}
