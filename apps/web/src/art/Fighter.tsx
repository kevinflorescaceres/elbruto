/**
 * El peleon dibujado como SVG normal, para la ficha. Comparte rutas y paleta
 * con el rig de Pixi del combate (PLAN.md fase 5: mismo personaje en los dos
 * sitios), pero sin arrastrar Pixi a esta pantalla.
 */
import { Fragment } from 'react';
import { getWeapon, type Appearance } from '@camorra/engine';
import { segun } from '../genero.js';
import {
  colorOf,
  GROSOR,
  lookFrom,
  PUNO,
  TRAZO,
  weaponShapes,
  Z_ORDER,
  type Expresion,
  type Joint,
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
          fill={shape.trazo === undefined ? colorOf(shape.fill, colors) : 'none'}
          stroke={
            shape.stroke === false
              ? 'none'
              : shape.trazo === undefined
                ? TRAZO
                : colorOf(shape.fill, colors)
          }
          strokeWidth={shape.stroke === false ? 0 : (shape.trazo ?? GROSOR)}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/**
 * La cabeza en sus capas. Con el gesto neutral lleva dos caras, ojos abiertos y
 * cerrados, que la animacion de `styles.css` alterna: el parpadeo es solo eso.
 */
function Cabeza({
  look,
  expresion,
  ritmo,
}: {
  look: Look;
  expresion: Expresion;
  ritmo: React.CSSProperties;
}) {
  const { debajo, caras, encima } = look.cabeza;
  return (
    <>
      <Piezas shapes={debajo} colors={look.colors} />
      {expresion === 'neutral' ? (
        <>
          <g className="ojos-abiertos" style={ritmo}>
            <Piezas shapes={caras.neutral} colors={look.colors} />
          </g>
          <g className="ojos-cerrados" style={ritmo}>
            <Piezas shapes={caras.parpadeo} colors={look.colors} />
          </g>
        </>
      ) : (
        <Piezas shapes={caras[expresion]} colors={look.colors} />
      )}
      <Piezas shapes={encima} colors={look.colors} />
    </>
  );
}

interface Props {
  appearance: Appearance;
  /** Necesario para derivar los campos que no esten guardados (§1.3). */
  slug: string;
  /** Categoria y alcance del arma en la mano. Sin arma, los punos. */
  weapon?: { category: WeaponCategory; reach: number };
  height?: number;
  /**
   * El gesto. Con `neutral` (por defecto) parpadea de vez en cuando, salvo con
   * menos movimiento (lo corta `styles.css`).
   */
  expresion?: Expresion;
}

/**
 * Ritmo del parpadeo segun el nombre: si todos parpadearan a la vez, una fila
 * de peleones en la arena se veria como un solo muneco repetido.
 */
function ritmoDeParpadeo(slug: string): React.CSSProperties {
  let h = 0;
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const duracion = 4.2 + (h % 13) / 10;
  return {
    animationDuration: `${duracion}s`,
    animationDelay: `-${((h >>> 4) % 40) / 10}s`,
  };
}

/**
 * El arma que se lleva al retrato: la de mas alcance, que es la que mas luce.
 * Vive aqui porque es una decision de dibujo, y la tenian copiada la arena y
 * la ficha.
 */
export function armaVisible(
  ids: string[],
): { category: WeaponCategory; reach: number } | undefined {
  const arma = ids.map(getWeapon).sort((a, b) => b.reach - a.reach)[0];
  return arma === undefined ? undefined : { category: arma.category, reach: arma.reach };
}

export function Fighter({ appearance, slug, weapon, height = 150, expresion = 'neutral' }: Props) {
  const look = lookFrom(appearance, slug);
  const hijos = new Map<PartName | null, Joint[]>();
  for (const part of look.rig) {
    const lista = hijos.get(part.parent) ?? [];
    lista.push(part);
    hijos.set(part.parent, lista);
  }

  const orden = (a: Joint, b: Joint): number => Z_ORDER.indexOf(a.name) - Z_ORDER.indexOf(b.name);

  // El puno siempre: sin mano, el arma parece flotar al lado del cuerpo.
  const arma = weapon === undefined ? [] : weaponShapes(weapon.category, weapon.reach);

  const render = (name: PartName): React.ReactNode => {
    const part = look.rig.find((p) => p.name === name);
    if (part === undefined) return null;
    const pose = REST.parts[name] ?? {};
    const x = part.at[0] + (pose.x ?? 0);
    const y = part.at[1] + (pose.y ?? 0);
    const shapes = look.parts[name];

    return (
      <g key={name} transform={`translate(${x} ${y}) rotate(${((pose.rot ?? 0) * 180) / Math.PI})`}>
        {name === 'head' ? (
          <Cabeza look={look} expresion={expresion} ritmo={ritmoDeParpadeo(slug)} />
        ) : (
          shapes !== undefined && <Piezas shapes={shapes} colors={look.colors} />
        )}
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
      viewBox="-58 -128 116 136"
      height={height}
      role="img"
      aria-label={segun(appearance.gender, 'Retrato del peleón', 'Retrato de la peleona')}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {render('hips')}
    </svg>
  );
}
