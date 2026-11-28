/**
 * Genera hojas de contacto del arte en SVG para poder mirarlas.
 * Herramienta de desarrollo: `pnpm --filter @camorra/web art`.
 */
import { writeFileSync } from 'node:fs';
import { createBrute, WEAPONS, type Appearance } from '@camorra/engine';
import { ESCENARIOS } from './escenarios.js';
import {
  brazoAtrasDelante,
  colorOf,
  GROSOR,
  MASCOTAS,
  PALETA,
  lookFrom,
  EXPRESIONES,
  montarCabeza,
  type Rasgos,
  PUNO,
  TRAZO,
  weaponShapes,
  profundidad,
  Z_DELANTE,
  type Look,
  type PartName,
  type Shape,
  type WeaponCategory,
} from './parts.js';
import { animacion, ANIMATIONS, REST, type AnimName, type Frame, type Variante } from './poses.js';

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

/** La misma regla de capa que el rig de Pixi, sobre la pose del frame. */
function atrasDelante(frame: Frame): boolean {
  const brazo = { ...REST.parts.armBack, ...frame.parts.armBack };
  const antebrazo = { ...REST.parts.forearmBack, ...frame.parts.forearmBack };
  return brazoAtrasDelante(brazo.x ?? 0, brazo.rot ?? 0, antebrazo.rot ?? 0);
}

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
    const spec = look.rig.find((p) => p.name === part);
    if (spec === undefined) return '';
    const pose = { ...REST.parts[part], ...frame.parts[part] };
    const x = spec.at[0] + (pose.x ?? 0);
    const y = spec.at[1] + (pose.y ?? 0);
    // La misma profundidad que `pixiRig.ts`: la forma propia de una parte va a
    // su altura de Z_ORDER entre sus hijos. Pintarla siempre antes de ellos
    // ponia el brazo de atras DELANTE del torso, y la hoja no era el combate.
    const propias = look.parts[part];
    const capas = [
      ...(propias === undefined
        ? []
        : [{ z: profundidad(part), svg: shapesToSvg(propias, look.colors) }]),
      ...look.rig
        .filter((p) => p.parent === part)
        .map((h) => ({
          z: h.name === 'armBack' && atrasDelante(frame) ? Z_DELANTE : profundidad(h.name),
          svg: render(h.name),
        })),
    ].sort((a, b) => a.z - b.z);
    return (
      `<g transform="translate(${x} ${y}) rotate(${((pose.rot ?? 0) * 180) / Math.PI})">` +
      capas.map((c) => c.svg).join('') +
      (part === 'forearmFront'
        ? `<g transform="translate(0 16) rotate(-20)">${shapesToSvg(arma, look.colors)}${shapesToSvg(PUNO, look.colors)}</g>`
        : '') +
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

// 2b. Golpes seguidos, frame a frame: que hace cada brazo en un combo. Cada
// animacion parte de donde dejo la anterior, como en el combate.
{
  type Estado = Frame['parts'];
  const tras = (estado: Estado, frame: Frame): Estado => {
    const out: Estado = { ...estado };
    for (const [part, pose] of Object.entries(frame.parts)) {
      out[part as PartName] = { ...out[part as PartName], ...pose };
    }
    return out;
  };
  /** Los frames de una animacion que mueven algo, ya apilados sobre `desde`. */
  const chirlo = createBrute('Chirlo de la Cava');
  const rig = lookFrom(chirlo.appearance, chirlo.slug).rig;
  const hombro = (name: PartName) => {
    const at = rig.find((j) => j.name === name)?.at ?? [0, 0];
    return { x: at[0], y: at[1] };
  };
  const hombros = { delante: hombro('armFront'), atras: hombro('armBack') };
  const recorrer = (desde: Estado, anim: AnimName, variante: Variante, etiqueta: string) => {
    const celdas: { label: string; estado: Estado }[] = [];
    let estado = desde;
    const { frames, contacto } = animacion(anim, { ...variante, hombros });
    for (const frame of frames) {
      if (Object.keys(frame.parts).length === 0) continue;
      estado = tras(estado, frame);
      const que =
        frame.t === 0
          ? 'parte'
          : frame.t === contacto
            ? 'pega'
            : frame.t === 1
              ? 'vuelve'
              : frame.t > (contacto ?? 1)
                ? 'aguanta'
                : 'carga';
      celdas.push({ label: `${etiqueta} ${que}`, estado });
    }
    return celdas;
  };
  /** Un combo: cada golpe arranca en el contacto del anterior, sin su vuelta. */
  const combo = (golpes: [AnimName, Variante, string][]) => {
    const celdas: { label: string; estado: Estado }[] = [];
    let estado: Estado = REST.parts;
    for (const [i, [anim, variante, etiqueta]] of golpes.entries()) {
      const pasos = recorrer(estado, anim, variante, etiqueta);
      const ultimo = i === golpes.length - 1;
      const hasta = pasos.findIndex((p) => p.label.endsWith('pega'));
      celdas.push(...(ultimo ? pasos : pasos.slice(0, hasta + 1)));
      estado = pasos[hasta]?.estado ?? estado;
    }
    return celdas;
  };
  const filas: { celdas: { label: string; estado: Estado }[]; arma?: string }[] = [
    {
      celdas: combo([
        ['attackRapida', {}, '1'],
        ['attackCruzado', { encadena: true }, '2'],
        ['attackRapida', { encadena: true, remata: true }, '3'],
      ]),
    },
    {
      arma: 'chaira',
      celdas: combo([
        ['attackRapida', {}, '1'],
        ['attackRapida', { encadena: true }, '2'],
        ['attackRapida', { encadena: true, remata: true }, '3'],
      ]),
    },
    {
      arma: 'tranca',
      celdas: combo([
        ['attackPesada', {}, '1'],
        ['attackPesada', { encadena: true, remata: true }, '2'],
      ]),
    },
    {
      arma: 'chuzo',
      celdas: combo([
        ['attackLarga', {}, '1'],
        ['attackLarga', { encadena: true, remata: true }, '2'],
      ]),
    },
    { celdas: recorrer(REST.parts, 'block', {}, 'para') },
  ];
  const porFila = Math.max(...filas.map((f) => f.celdas.length));
  sheet(
    `${salida}/golpes.svg`,
    filas.flatMap(({ celdas, arma }) => {
      const w = arma === undefined ? undefined : WEAPONS.find((x) => x.id === arma);
      const relleno = Array.from({ length: porFila - celdas.length }, () => ({
        label: '',
        body: '',
      }));
      return [
        ...celdas.map((c) => ({
          label: c.label,
          body: figure(
            'Chirlo de la Cava',
            { t: 0, parts: c.estado },
            w === undefined ? undefined : { category: w.category, reach: w.reach },
          ),
        })),
        ...relleno,
      ];
    }),
    porFila,
  );
}

// 3. Todas las armas del catalogo en la mano.
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

const colorHojaCaras: Look['colors'] = {
  piel: PALETA.piel[1],
  pelo: PALETA.pelo[2],
  ropa: PALETA.ropa[0],
  ropa2: PALETA.ropa[1],
};

// 5a. Expresiones: cada gesto sobre varias caras, con parche y bigote incluidos,
// que son lo que mas se pisa con los ojos y la boca.
{
  const muestras: { rasgos: Rasgos; label: string }[] = [
    { rasgos: { head: 0, hair: 0, beard: 0, brow: 0, mouth: 0, mark: 0 }, label: 'lisa' },
    { rasgos: { head: 1, hair: 3, beard: 2, brow: 1, mouth: 3, mark: 4 }, label: 'parche' },
    { rasgos: { head: 2, hair: 1, beard: 5, brow: 2, mouth: 1, mark: 5 }, label: 'barba' },
    { rasgos: { head: 3, hair: 2, beard: 4, brow: 3, mouth: 2, mark: 3 }, label: 'chirlo' },
  ];
  const ancho = 110;
  const alto = 130;
  const celdas = muestras.flatMap(({ rasgos, label }) =>
    EXPRESIONES.map((e) => ({
      label: `${label} ${e}`,
      body: `<g transform="translate(0 40) scale(1.6)">${shapesToSvg(montarCabeza(rasgos, undefined, e), colorHojaCaras)}</g>`,
    })),
  );
  const porFila = EXPRESIONES.length;
  writeFileSync(
    `${salida}/expresiones.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${porFila * ancho}" height="${muestras.length * alto}" viewBox="0 0 ${porFila * ancho} ${muestras.length * alto}"><rect width="100%" height="100%" fill="#f6f6f4"/>` +
      celdas
        .map((c, i) => {
          const cx = (i % porFila) * ancho + ancho / 2;
          const cy = Math.floor(i / porFila) * alto + 75;
          return (
            `<g transform="translate(${cx} ${cy})">${c.body}</g>` +
            `<text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">${c.label}</text>`
          );
        })
        .join('') +
      '</svg>',
  );
}

// 5b. Cabezas: cada pelo sobre las cuatro mandibulas, y con dos sombreros de
// prueba. Los sombreros son un galibo, no arte del juego: comprueban que la
// calota comun deja sitio a uno sin que el pelo se salga por debajo del ala.
const GALIBOS: Record<string, Shape[]> = {
  boina: [
    { d: 'M -20 -31 Q -24 -47 0 -49 Q 25 -48 21 -32 Q 0 -35 -20 -31 Z', fill: 'oscuro' },
    { d: 'M -1 -49 L 0 -53 L 1.5 -49', fill: 'oscuro', trazo: 2.4 },
  ],
  ala: [
    { d: 'M -14 -33 L -12.5 -50 Q 0 -54 12.5 -50 L 14 -33 Z', fill: 'cuero' },
    { d: 'M -14 -38 L 14 -38 L 14 -34 L -14 -34 Z', fill: 'oscuro', stroke: false },
    { d: 'M -27 -32 Q 0 -38 27 -32 Q 0 -29 -27 -32 Z', fill: 'cuero' },
  ],
};
const colorHoja: Look['colors'] = {
  piel: PALETA.piel[1],
  pelo: PALETA.pelo[1],
  ropa: PALETA.ropa[0],
  ropa2: PALETA.ropa[1],
};
const cabezas: { label: string; body: string }[] = [];
for (const sombrero of [undefined, 'boina', 'ala'] as const) {
  for (let hair = 0; hair < 6; hair++) {
    for (let head = 0; head < 4; head++) {
      const rasgos: Rasgos = {
        head,
        hair,
        beard: head === 3 ? 5 : head,
        brow: head,
        mouth: hair % 4,
        mark: head === 0 ? 3 : 0,
      };
      const formas = montarCabeza(rasgos, sombrero === undefined ? undefined : GALIBOS[sombrero]);
      cabezas.push({
        label: `p${hair} c${head}${sombrero === undefined ? '' : ' ' + sombrero}`,
        body: `<g transform="translate(0 40) scale(1.6)">${shapesToSvg(formas, colorHoja)}</g>`,
      });
    }
  }
}
{
  const porFila = 8;
  const filas = Math.ceil(cabezas.length / porFila);
  writeFileSync(
    `${salida}/cabezas.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${porFila * 110}" height="${filas * 130}" viewBox="0 0 ${porFila * 110} ${filas * 130}"><rect width="100%" height="100%" fill="#f6f6f4"/>` +
      cabezas
        .map((c, i) => {
          const cx = (i % porFila) * 110 + 55;
          const cy = Math.floor(i / porFila) * 130 + 75;
          return (
            `<g transform="translate(${cx} ${cy})">${c.body}</g>` +
            `<text x="${cx}" y="${cy + 50}" text-anchor="middle" font-family="monospace" font-size="10" fill="#444">${c.label}</text>`
          );
        })
        .join('') +
      '</svg>',
  );
}

// 6. Escenarios, a tamano real del lienzo y con un peleon dentro para escala.
const peleonMuestra = figure('Chirlo de la Cava', REST, { category: 'pesada', reach: 2 });
writeFileSync(
  `${salida}/escenarios.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${ESCENARIOS.length * 452}" viewBox="0 0 900 ${ESCENARIOS.length * 452}">` +
    ESCENARIOS.map((esc, i) => {
      const y = i * 452;
      const fondo = esc.piezas
        .map(
          (pz) =>
            `<path d="${pz.d}" fill="${pz.color}"${
              pz.trazo === undefined
                ? ''
                : ` stroke="${pz.trazo.color}" stroke-width="${pz.trazo.grosor}" stroke-linecap="round"`
            }/>`,
        )
        .join('');
      return (
        `<g transform="translate(0 ${y})">${fondo}` +
        `<g transform="translate(252 349)">${peleonMuestra}</g>` +
        `<g transform="translate(648 349) scale(-1 1)">${peleonMuestra}</g>` +
        `<text x="12" y="24" font-family="monospace" font-size="14" fill="#241f1c">${esc.nombre}</text></g>`
      );
    }).join('') +
    '</svg>',
);

// 7. Imagen para compartir (Open Graph). Se rasteriza una vez y se versiona.
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
