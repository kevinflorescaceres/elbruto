/**
 * Genera hojas de contacto del arte en SVG para poder mirarlas.
 * Herramienta de desarrollo: `pnpm --filter @rufianes/web art`.
 */
import { writeFileSync } from 'node:fs';
import { createBrute, WEAPONS } from '@rufianes/engine';
import {
  colorOf,
  GROSOR,
  MASCOTAS,
  PALETA,
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
import { ANIMATIONS, REST, type AnimName, type Frame } from './poses.js';

const shapesToSvg = (shapes: Shape[], colors: Look['colors']): string =>
  shapes
    .map(
      (s) =>
        `<path d="${s.d}" fill="${colorOf(s.fill, colors)}"` +
        (s.stroke === false
          ? ' stroke="none"'
          : ` stroke="${TRAZO}" stroke-width="${GROSOR}" stroke-linejoin="round" stroke-linecap="round"`) +
        '/>',
    )
    .join('');

/** Dibuja el rig en una pose concreta. */
function figure(
  name: string,
  frame: Frame,
  weapon?: { category: WeaponCategory; reach: number },
): string {
  const look = lookFrom(createBrute(name).appearance);
  const arma = weapon === undefined ? [] : weaponShapes(weapon.category, weapon.reach);

  const render = (part: PartName): string => {
    const spec = RIG.find((p) => p.name === part);
    if (spec === undefined) return '';
    const pose = { ...REST.parts[part], ...frame.parts[part] };
    const x = spec.at[0] + (pose.x ?? 0);
    const y = spec.at[1] + (pose.y ?? 0);
    const hijos = RIG.filter((p) => p.parent === part).sort(
      (a, b) => Z_ORDER.indexOf(a.name) - Z_ORDER.indexOf(b.name),
    );
    const propias = look.parts[part];
    return (
      `<g transform="translate(${x} ${y}) rotate(${((pose.rot ?? 0) * 180) / Math.PI})">` +
      (propias === undefined ? '' : shapesToSvg(propias, look.colors)) +
      (part === 'forearmFront'
        ? `<g transform="translate(0 16) rotate(-20)">${shapesToSvg(arma, look.colors)}${shapesToSvg(PUNO, look.colors)}</g>`
        : '') +
      hijos.map((h) => render(h.name)).join('') +
      '</g>'
    );
  };

  return render('hips');
}

function sheet(file: string, celdas: { label: string; body: string }[], porFila = 6): void {
  const ancho = 150;
  const alto = 175;
  const filas = Math.ceil(celdas.length / porFila);
  const cuerpo = celdas
    .map((c, i) => {
      const cx = (i % porFila) * ancho + ancho / 2;
      const cy = Math.floor(i / porFila) * alto + 140;
      return (
        `<g transform="translate(${cx} ${cy})">${c.body}</g>` +
        `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-family="monospace" font-size="11" fill="#444">${c.label}</text>`
      );
    })
    .join('');
  writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${porFila * ancho}" height="${filas * alto}" viewBox="0 0 ${porFila * ancho} ${filas * alto}"><rect width="100%" height="100%" fill="#f6f6f4"/>${cuerpo}</svg>`,
  );
}

/**
 * Los keyframes son acumulativos: cada uno solo lista lo que cambia. Para verlos
 * hay que apilarlos hasta el frame elegido, o salen poses a medias.
 */
function peakFrame(anim: AnimName): Frame {
  const frames = ANIMATIONS[anim].frames;
  let mejor: Frame = { t: 0, parts: {} };
  let acumulado: Frame['parts'] = {};
  let maximo = -1;

  for (const frame of frames) {
    acumulado = { ...acumulado };
    for (const [part, pose] of Object.entries(frame.parts)) {
      acumulado[part as PartName] = { ...acumulado[part as PartName], ...pose };
    }
    // El frame mas expresivo es el de mayor rotacion acumulada.
    const fuerza = Object.values(acumulado).reduce((sum, p) => sum + Math.abs(p?.rot ?? 0), 0);
    if (fuerza > maximo) {
      maximo = fuerza;
      mejor = { t: frame.t, parts: acumulado };
    }
  }
  return mejor;
}

const salida = process.argv[2] ?? '.';

// 1. Variedad: doce nombres distintos, tal como salen del hash.
const nombres = [
  'Chirlo de la Cava',
  'Tuerto del Arrabal',
  'Pelon el Jaque',
  'Mellado de Poniente',
  'Zurdo de la Sierpe',
  'Bizco de Santa Cruz',
  'Rengo el Gallo',
  'Manco de la Cava',
  'Jaque de Poniente',
  'Rufo el Tuerto',
  'Cana de la Sierpe',
  'Tizon del Arrabal',
];
sheet(
  `${salida}/variedad.svg`,
  nombres.map((n) => ({ label: n.split(' ')[0] ?? n, body: figure(n, REST) })),
);

// 2. Las doce animaciones, en su frame mas expresivo.
const anims = Object.keys(ANIMATIONS) as AnimName[];
sheet(
  `${salida}/poses.svg`,
  anims.map((anim) => ({ label: anim, body: figure('Chirlo de la Cava', peakFrame(anim)) })),
);

// 3. Las diez armas en la mano.
sheet(
  `${salida}/armas.svg`,
  WEAPONS.map((w) => ({
    label: w.id,
    body: figure('Zurdo de la Sierpe', REST, { category: w.category, reach: w.reach }),
  })),
  5,
);

// 4. Las tres mascotas.
sheet(
  `${salida}/bichos.svg`,
  Object.entries(MASCOTAS).map(([id, shapes]) => ({
    label: id,
    body: `<g transform="translate(0 0)">${shapesToSvg(shapes, {
      piel: PALETA.piel[2] ?? '#c68a5e',
      pelo: PALETA.pelo[1] ?? '#5b3a22',
      ropa: '#000000',
    })}</g>`,
  })),
  3,
);

console.log(`hojas escritas en ${salida}`);
