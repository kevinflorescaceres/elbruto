/**
 * Genera hojas de contacto del arte en SVG para poder mirarlas.
 * Herramienta de desarrollo: `pnpm --filter @camorra/web art`.
 */
import { writeFileSync } from 'node:fs';
import { createBrute, WEAPONS, type Appearance } from '@camorra/engine';
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
        `<path d="${s.d}" fill="${s.trazo === undefined ? colorOf(s.fill, colors) : 'none'}"` +
        (s.stroke === false
          ? ' stroke="none"'
          : ` stroke="${s.trazo === undefined ? TRAZO : colorOf(s.fill, colors)}"` +
            ` stroke-width="${s.trazo ?? GROSOR}" stroke-linejoin="round" stroke-linecap="round"`) +
        '/>',
    )
    .join('');

/** Dibuja el rig en una pose concreta. */
function figure(
  name: string,
  frame: Frame,
  weapon?: { category: WeaponCategory; reach: number },
): string {
  const peleon = createBrute(name);
  const look = lookFrom(peleon.appearance, peleon.slug);
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
      ropa2: '#000000',
      ropa: '#000000',
    })}</g>`,
  })),
  3,
);

// 5. Caras: las piezas nuevas, variando una cosa cada vez.
const cara = (campos: Partial<Appearance>, label: string) => {
  const look = lookFrom(
    {
      body: 0,
      head: 0,
      hair: 0,
      skinColor: 1,
      hairColor: 1,
      clothColor: 0,
      brow: 0,
      mouth: 0,
      beard: 0,
      mark: 0,
      ...campos,
    },
    'hoja',
  );
  return {
    label,
    body: `<g transform="translate(0 40) scale(1.7)">${shapesToSvg(look.parts.head ?? [], look.colors)}</g>`,
  };
};

const caras = [
  ...[0, 1, 2, 3].map((brow) => cara({ brow }, `ceja ${brow}`)),
  ...[0, 1, 2, 3].map((mouth) => cara({ mouth }, `boca ${mouth}`)),
  ...[0, 1, 2, 3, 4, 5].map((beard) => cara({ beard }, `barba ${beard}`)),
  ...[0, 3, 4, 5].map((mark) => cara({ mark }, `marca ${mark}`)),
  ...[0, 1, 2, 3].map((head) => cara({ head, beard: 5, mark: 3 }, `craneo ${head}`)),
  ...[0, 1, 2, 3, 4, 5].map((hair) => cara({ hair, beard: 3 }, `pelo ${hair}`)),
];

const POR_FILA = 6;
writeFileSync(
  `${salida}/caras.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${POR_FILA * 130}" height="${Math.ceil(caras.length / POR_FILA) * 150}" viewBox="0 0 ${POR_FILA * 130} ${Math.ceil(caras.length / POR_FILA) * 150}"><rect width="100%" height="100%" fill="#f6f6f4"/>` +
    caras
      .map((c, i) => {
        const cx = (i % POR_FILA) * 130 + 65;
        const cy = Math.floor(i / POR_FILA) * 150 + 60;
        return (
          `<g transform="translate(${cx} ${cy})">${c.body}</g>` +
          `<text x="${cx}" y="${cy + 74}" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">${c.label}</text>`
        );
      })
      .join('') +
    '</svg>',
);

// 6. Imagen para compartir (Open Graph). Se rasteriza una vez y se versiona.
const og = (): string => {
  const izq = figure('Chirlo de la Cava', REST, { category: 'pesada', reach: 2 });
  const der = figure('Tuerto del Arrabal', REST, { category: 'larga', reach: 3 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#241f1c"/>
    <rect y="574" width="1200" height="5" fill="#4a423c"/>
    <g transform="translate(370 570) scale(3)">${izq}</g>
    <g transform="translate(830 570) scale(3) scale(-1 1)">${der}</g>
    <text x="600" y="132" text-anchor="middle" font-family="Georgia, serif" font-size="104"
          font-weight="bold" fill="#f2e8dc" letter-spacing="8">CAMORRA</text>
    <text x="600" y="190" text-anchor="middle" font-family="Georgia, serif" font-size="32"
          fill="#a89684">Pon un nombre y tendrás un peleón</text>
  </svg>`;
};
writeFileSync(`${salida}/og.svg`, og());

console.log(`hojas escritas en ${salida}`);
