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
  GROSOR,
  lookFrom,
  PUNO,
  RIG,
  TRAZO,
  weaponShapes,
  Z_ORDER,
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
        `<path d="${shape.d}" fill="${colorOf(shape.fill, colors)}"` +
        (shape.stroke === false
          ? ' stroke="none"'
          : ` stroke="${TRAZO}" stroke-width="${GROSOR}" stroke-linejoin="round" stroke-linecap="round"`) +
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
}

export function buildRig(
  appearance: Appearance,
  slug: string,
  weapon?: { category: WeaponCategory; reach: number },
): Rig {
  const look = lookFrom(appearance, slug);
  const parts = new Map<PartName, Container>();
  const root = new Container();

  // Z_ORDER da la profundidad, y la forma propia de una parte usa la suya: asi
  // el brazo de atras queda detras del torso y el de delante por encima.
  const depth = (name: PartName): number => {
    const index = Z_ORDER.indexOf(name);
    return index === -1 ? Z_ORDER.indexOf('torso') : index;
  };

  for (const spec of RIG) {
    const node = new Container();
    const pose = REST.parts[spec.name] ?? {};
    node.x = spec.at[0] + (pose.x ?? 0);
    node.y = spec.at[1] + (pose.y ?? 0);
    node.rotation = pose.rot ?? 0;
    node.zIndex = depth(spec.name);
    node.sortableChildren = true;

    const shapes = look.parts[spec.name];
    if (shapes !== undefined) {
      const graphics = node.addChild(drawShapes(shapes, look.colors));
      graphics.zIndex = depth(spec.name);
    }

    parts.set(spec.name, node);
  }

  for (const spec of RIG) {
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

  const rig: Rig = { root, parts, hand, colors: look.colors };
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
