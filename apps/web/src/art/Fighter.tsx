/**
 * El peleon dibujado como SVG normal, para la ficha. Comparte rutas y paleta
 * con el rig de Pixi del combate (PLAN.md fase 5: mismo personaje en los dos
 * sitios), pero sin arrastrar Pixi a esta pantalla.
 */
import { Fragment } from 'react';
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

function Piezas({ shapes, colors }: { shapes: Shape[]; colors: Look['colors'] }) {
  return (
    <>
      {shapes.map((shape, i) => (
        <path
          key={i}
          d={shape.d}
          fill={colorOf(shape.fill, colors)}
          stroke={shape.stroke === false ? 'none' : TRAZO}
          strokeWidth={shape.stroke === false ? 0 : GROSOR}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

interface Props {
  appearance: Appearance;
  /** Categoria y alcance del arma en la mano. Sin arma, los punos. */
  weapon?: { category: WeaponCategory; reach: number };
  height?: number;
}

export function Fighter({ appearance, weapon, height = 150 }: Props) {
  const look = lookFrom(appearance);
  const hijos = new Map<PartName | null, typeof RIG>();
  for (const part of RIG) {
    const lista = hijos.get(part.parent) ?? [];
    lista.push(part);
    hijos.set(part.parent, lista);
  }

  const orden = (a: (typeof RIG)[number], b: (typeof RIG)[number]): number =>
    Z_ORDER.indexOf(a.name) - Z_ORDER.indexOf(b.name);

  // El puno siempre: sin mano, el arma parece flotar al lado del cuerpo.
  const arma = weapon === undefined ? [] : weaponShapes(weapon.category, weapon.reach);

  const render = (name: PartName): React.ReactNode => {
    const part = RIG.find((p) => p.name === name);
    if (part === undefined) return null;
    const pose = REST.parts[name] ?? {};
    const x = part.at[0] + (pose.x ?? 0);
    const y = part.at[1] + (pose.y ?? 0);
    const shapes = look.parts[name];

    return (
      <g key={name} transform={`translate(${x} ${y}) rotate(${((pose.rot ?? 0) * 180) / Math.PI})`}>
        {shapes !== undefined && <Piezas shapes={shapes} colors={look.colors} />}
        {name === 'forearmFront' && (
          <g transform="translate(0 16) rotate(-20)">
            <Piezas shapes={arma} colors={look.colors} />
            <Piezas shapes={PUNO} colors={look.colors} />
          </g>
        )}
        {(hijos.get(name) ?? []).sort(orden).map((hijo) => (
          <Fragment key={hijo.name}>{render(hijo.name)}</Fragment>
        ))}
      </g>
    );
  };

  return (
    <svg
      viewBox="-58 -116 116 124"
      height={height}
      role="img"
      aria-label="Retrato del peleón"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {render('hips')}
    </svg>
  );
}
