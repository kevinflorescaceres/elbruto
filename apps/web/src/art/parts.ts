/**
 * El arte, como datos. Rutas SVG y paletas, sin saber nada de Pixi ni del DOM.
 *
 * Lo consumen dos renderers: el rig de Pixi en el combate y un <svg> normal de
 * React en la ficha. Un solo origen para que el peleon sea el mismo en los dos
 * sitios (PLAN.md fase 5) sin arrastrar Pixi a la pantalla de perfil.
 *
 * Arte original de este proyecto (PLAN.md §11): trazo grueso, color plano y
 * cabeza grande. Dibujado desde cero, sin parecido con ningun otro juego.
 *
 * Sistema de coordenadas del personaje: origen entre los pies, la altura crece
 * hacia -y. Un peleon mide unas 96 unidades.
 */
import { clothColor2For, type Appearance, type WeaponCategory } from '@camorra/engine';

export type PartName =
  | 'hips'
  | 'torso'
  | 'head'
  | 'armBack'
  | 'forearmBack'
  | 'armFront'
  | 'forearmFront'
  | 'legBack'
  | 'legFront';

export type Tinte =
  | 'piel'
  | 'pelo'
  | 'ropa'
  | 'ropa2'
  | 'metal'
  | 'madera'
  | 'oscuro'
  | 'pantalon'
  | 'cuero'
  | 'trapo';

export interface Shape {
  d: string;
  fill: Tinte;
  /** Sin trazo para los detalles finos, que si no se emborronan. */
  stroke?: false;
}

export const PALETA = {
  piel: ['#f2d3b3', '#e0b088', '#c68a5e', '#9c6440', '#6f4529'],
  pelo: ['#2b2118', '#5b3a22', '#9c6b35', '#c9a227', '#8a8a8a', '#b04a2a'],
  ropa: ['#8a5a3c', '#41627f', '#5f7245', '#8a4a5a', '#554a7a', '#7a6a3a', '#35696a', '#7a3a3a'],
  metal: '#8c8c94',
  madera: '#8a6a44',
  oscuro: '#241f1c',
  pantalon: '#3f3833',
  cuero: '#5b3a22',
  trapo: '#d8c9a8',
} as const;

export const TRAZO = '#241f1c';
export const GROSOR = 3;

/** Articulaciones: donde cuelga cada parte de su padre. */
export const RIG: { name: PartName; parent: PartName | null; at: [number, number] }[] = [
  { name: 'hips', parent: null, at: [0, -42] },
  { name: 'legBack', parent: 'hips', at: [-6, 0] },
  { name: 'legFront', parent: 'hips', at: [6, 0] },
  { name: 'torso', parent: 'hips', at: [0, 0] },
  { name: 'armBack', parent: 'torso', at: [-15, -25] },
  { name: 'forearmBack', parent: 'armBack', at: [0, 15] },
  { name: 'head', parent: 'torso', at: [0, -28] },
  { name: 'armFront', parent: 'torso', at: [15, -25] },
  { name: 'forearmFront', parent: 'armFront', at: [0, 15] },
];

/** Orden de pintado dentro de cada padre. Lo de delante, al final. */
export const Z_ORDER: PartName[] = ['legBack', 'armBack', 'legFront', 'torso', 'head', 'armFront'];

// --- Piezas ---

const PIERNA: Shape[] = [
  { d: 'M -5 -2 L -5 30 L 5 30 L 5 -2 Z', fill: 'pantalon' },
  // Bota con vuelta. El encargo da un par frontal, una bota por pie apuntando
  // hacia fuera; el rig va de perfil, asi que las dos llevan la que mira al frente.
  { d: 'M -5 28 L 7 28 Q 12 28 12 34 Q 12 37 10 37 L -5 37 Z', fill: 'cuero' },
];

const ANTEBRAZO: Shape[] = [{ d: 'M -4 0 L -4 13 Q -4 16 0 16 Q 4 16 4 13 L 4 0 Z', fill: 'piel' }];

const BRAZO: Shape[] = [
  {
    d: 'M -5 -2 L -5 14 Q -5 17 0 17 Q 5 17 5 14 L 5 -2 Q 5 -5 0 -5 Q -5 -5 -5 -2 Z',
    fill: 'ropa',
  },
];

/** Tres complexiones: enjuto, recio y medio. */
const TORSOS: Shape[][] = [
  [
    {
      d: 'M -13 2 Q -16 -13 -14 -24 Q -14 -30 -8 -30 L 8 -30 Q 14 -30 14 -24 Q 16 -13 13 2 Z',
      fill: 'ropa',
    },
  ],
  [
    {
      d: 'M -16 2 Q -19 -14 -17 -25 Q -17 -31 -9 -31 L 9 -31 Q 17 -31 17 -25 Q 19 -14 16 2 Z',
      fill: 'ropa',
    },
  ],
  [
    {
      d: 'M -14 2 Q -18 -12 -15 -24 Q -15 -30 -8 -30 L 8 -30 Q 15 -30 15 -24 Q 18 -12 14 2 Z',
      fill: 'ropa',
    },
  ],
];

/**
 * Detalle que llevan todos, no es variante. La faja va en `ropa2` para que no
 * desaparezca dentro del jubon, y el escote evita que la cabeza flote sobre un
 * rectangulo.
 */
const DETALLE_TORSO: Shape[] = [
  { d: 'M -14 -5 L 14 -5 L 13 3 L -13 3 Z', fill: 'ropa2' },
  { d: 'M -5 -30 L 0 -20 L 5 -30', fill: 'piel' },
];

/** Cuatro craneos: redonda, cuadrada, alargada y ancha de pomulos. */
const CABEZAS: Shape[][] = [
  [{ d: 'M -20 -18 Q -20 -40 0 -40 Q 20 -40 20 -18 Q 20 0 0 0 Q -20 0 -20 -18 Z', fill: 'piel' }],
  [
    {
      d: 'M -19 -38 L 19 -38 Q 21 -38 21 -34 L 21 -10 Q 21 0 11 0 L -11 0 Q -21 0 -21 -10 L -21 -34 Q -21 -38 -19 -38 Z',
      fill: 'piel',
    },
  ],
  [{ d: 'M -17 -20 Q -17 -42 0 -42 Q 17 -42 17 -20 Q 17 2 0 2 Q -17 2 -17 -20 Z', fill: 'piel' }],
  [
    {
      d: 'M -22 -26 Q -22 -40 0 -40 Q 22 -40 22 -26 Q 22 -16 14 -8 Q 7 0 0 0 Q -7 0 -14 -8 Q -22 -16 -22 -26 Z',
      fill: 'piel',
    },
  ],
];

/**
 * Ojos y boca, iguales para todos por ahora. En el paso 5 pasan a ser campos
 * propios (`brow`, `mouth`) con sus variantes.
 */
const CARA: Shape[] = [
  { d: 'M -9 -22 a 2.6 2.6 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
  { d: 'M 9 -22 a 2.6 2.6 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
  { d: 'M -6 -8 Q 0 -4 6 -8', fill: 'oscuro', stroke: false },
];

/** Seis pelos: rapado, greñas, cresta, melena, entradas con coleta y calvo con corona. */
const PELOS: Shape[][] = [
  [
    {
      d: 'M -20 -24 Q -18 -42 0 -42 Q 18 -42 20 -24 Q 10 -34 0 -33 Q -10 -34 -20 -24 Z',
      fill: 'pelo',
    },
  ],
  [
    {
      d: 'M -21 -18 Q -22 -43 0 -43 Q 22 -43 21 -18 Q 17 -27 13 -20 Q 9 -29 4 -21 Q -1 -30 -6 -21 Q -11 -29 -15 -20 Q -18 -26 -21 -18 Z',
      fill: 'pelo',
    },
  ],
  [
    {
      d: 'M -16 -30 Q -14 -38 0 -38 Q 14 -38 16 -30 Q 8 -34 0 -34 Q -8 -34 -16 -30 Z',
      fill: 'pelo',
    },
    { d: 'M -5 -36 Q -9 -52 0 -55 Q 9 -52 5 -36 Q 0 -39 -5 -36 Z', fill: 'pelo' },
  ],
  [
    {
      d: 'M -20 -22 Q -22 -42 0 -42 Q 22 -42 20 -22 L 22 4 Q 16 6 15 -2 Q 14 -28 0 -28 Q -14 -28 -15 -2 Q -16 6 -22 4 Z',
      fill: 'pelo',
    },
  ],
  [
    {
      d: 'M -18 -28 Q -14 -40 0 -40 Q 14 -40 18 -28 Q 12 -34 6 -33 Q 8 -38 0 -38 Q -8 -38 -6 -33 Q -12 -34 -18 -28 Z',
      fill: 'pelo',
    },
    { d: 'M 17 -31 Q 29 -29 27 -15 Q 24 -22 16 -25 Z', fill: 'pelo' },
  ],
  [
    { d: 'M -20 -20 Q -21 -29 -17 -32 Q -16 -23 -12 -20 Z', fill: 'pelo' },
    { d: 'M 20 -20 Q 21 -29 17 -32 Q 16 -23 12 -20 Z', fill: 'pelo' },
  ],
];

// --- Armas: una silueta por categoria, con variacion segun las stats ---

export type { WeaponCategory };

const ARMAS: Record<WeaponCategory, Shape[]> = {
  rapida: [
    { d: 'M 0 -2 L 3 -2 L 3 3 L 0 3 Z', fill: 'madera' },
    { d: 'M 3 -2.5 L 22 -1.5 L 24 0.5 L 22 2.5 L 3 3.5 Z', fill: 'metal' },
  ],
  media: [
    { d: 'M 0 -2.5 L 5 -2.5 L 5 3 L 0 3 Z', fill: 'madera' },
    { d: 'M 5 -4 L 7 -4 L 7 4 L 5 4 Z', fill: 'metal' },
    { d: 'M 7 -4 L 26 -3 L 30 0 L 26 4 L 7 5 Z', fill: 'metal' },
  ],
  pesada: [
    { d: 'M 0 -2 L 20 -2 L 20 2 L 0 2 Z', fill: 'madera' },
    { d: 'M 18 -7 L 31 -6 Q 34 0 31 6 L 18 7 Z', fill: 'metal' },
  ],
  larga: [
    { d: 'M 0 -1.8 L 34 -1.8 L 34 1.8 L 0 1.8 Z', fill: 'madera' },
    { d: 'M 34 -4 L 45 0 L 34 4 Z', fill: 'metal' },
  ],
  arrojadiza: [{ d: 'M 4 -8 L 15 -9 L 19 0 L 14 8 L 4 7 L 1 -1 Z', fill: 'madera' }],
};

export const PUNO: Shape[] = [{ d: 'M 0 0 a 5 5 0 1 0 0.1 0 Z', fill: 'piel' }];

/**
 * Mascotas de perfil, mirando a la derecha. Pies en y=0, el cuerpo crece hacia
 * -y, igual que el peleon. Cada una con su silueta.
 */
export const MASCOTAS: Record<string, Shape[]> = {
  // Chucho: flaco, patas largas, oreja de punta y rabo tieso.
  chucho: [
    { d: 'M -13 -13 L -8 -13 L -8 0 L -13 0 Z', fill: 'pelo' },
    { d: 'M 6 -13 L 11 -13 L 11 0 L 6 0 Z', fill: 'pelo' },
    {
      d: 'M -16 -24 Q -18 -32 -10 -32 L 8 -32 Q 16 -32 16 -24 L 16 -16 Q 16 -11 9 -11 L -9 -11 Q -16 -11 -16 -16 Z',
      fill: 'pelo',
    },
    { d: 'M -16 -28 Q -26 -34 -24 -22', fill: 'pelo', stroke: false },
    { d: 'M 14 -30 Q 27 -32 28 -22 Q 29 -15 21 -15 L 14 -16 Z', fill: 'pelo' },
    { d: 'M 17 -32 L 15 -43 L 24 -34 Z', fill: 'pelo' },
    { d: 'M 27 -20 a 2.4 2.4 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
    { d: 'M 23 -25 a 1.6 1.6 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
  ],

  // Mastin: mas alto y macizo, oreja caida y pecho ancho.
  mastin: [
    { d: 'M -16 -15 L -9 -15 L -9 0 L -16 0 Z', fill: 'madera' },
    { d: 'M 7 -15 L 14 -15 L 14 0 L 7 0 Z', fill: 'madera' },
    {
      d: 'M -20 -30 Q -22 -41 -11 -41 L 10 -41 Q 21 -41 21 -30 L 21 -19 Q 21 -13 12 -13 L -11 -13 Q -20 -13 -20 -19 Z',
      fill: 'madera',
    },
    { d: 'M -20 -36 Q -29 -40 -27 -28', fill: 'madera', stroke: false },
    { d: 'M 18 -38 Q 34 -40 35 -27 Q 36 -18 26 -18 L 18 -20 Z', fill: 'madera' },
    { d: 'M 20 -39 Q 30 -42 29 -30 Q 25 -33 20 -32 Z', fill: 'madera' },
    { d: 'M 33 -24 a 2.8 2.8 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
    { d: 'M 28 -31 a 1.8 1.8 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
  ],

  // Jabali: lomo alto, cabeza baja, jeta y colmillo.
  jabali: [
    { d: 'M -17 -14 L -11 -14 L -11 0 L -17 0 Z', fill: 'oscuro' },
    { d: 'M 8 -14 L 14 -14 L 14 0 L 8 0 Z', fill: 'oscuro' },
    {
      d: 'M -22 -26 Q -24 -44 -6 -46 L 8 -46 Q 22 -44 22 -28 L 22 -18 Q 22 -12 12 -12 L -12 -12 Q -22 -12 -22 -18 Z',
      fill: 'pelo',
    },
    { d: 'M -6 -46 L -2 -54 L 2 -46 M 4 -46 L 8 -53 L 11 -45', fill: 'pelo', stroke: false },
    { d: 'M 19 -40 Q 36 -38 37 -26 Q 38 -16 26 -16 L 19 -19 Z', fill: 'pelo' },
    { d: 'M 34 -24 Q 42 -24 42 -18 Q 42 -13 34 -13 Z', fill: 'piel' },
    { d: 'M 33 -24 L 41 -33 L 36 -21 Z', fill: 'piel' },
    { d: 'M 30 -32 a 2 2 0 1 0 0.1 0 Z', fill: 'oscuro', stroke: false },
  ],
};

// --- Resolucion desde la apariencia ---

export interface Look {
  parts: Partial<Record<PartName, Shape[]>>;
  colors: { piel: string; pelo: string; ropa: string; ropa2: string };
}

const pickFrom = <T>(list: readonly T[], index: number): T => {
  const item = list[index % list.length];
  if (item === undefined) throw new Error('lista de variantes vacia');
  return item;
};

/**
 * De la apariencia guardada (derivada del nombre en la fase 1) al conjunto de
 * piezas y colores. `Appearance` genera rangos mas amplios de los que hay
 * dibujados: el modulo reparte y sigue siendo determinista.
 */
export function lookFrom(appearance: Appearance, slug: string): Look {
  const cabeza = pickFrom(CABEZAS, appearance.head);
  const pelo = pickFrom(PELOS, appearance.hair);

  const ropa = pickFrom(PALETA.ropa, appearance.clothColor);
  // Si la faja sale del mismo color que el jubon, desaparece dentro: se coge la
  // siguiente de la lista (ARTE-Y-TOKENS.md §1.6).
  const iFaja = appearance.clothColor2 ?? clothColor2For(slug);
  const faja =
    pickFrom(PALETA.ropa, iFaja) === ropa
      ? pickFrom(PALETA.ropa, iFaja + 1)
      : pickFrom(PALETA.ropa, iFaja);

  return {
    parts: {
      // Orden de pintado dentro de la cabeza: craneo, pelo, ojos y boca.
      torso: [...pickFrom(TORSOS, appearance.body), ...DETALLE_TORSO],
      head: [...cabeza, ...pelo, ...CARA],
      legBack: PIERNA,
      legFront: PIERNA,
      armBack: BRAZO,
      armFront: BRAZO,
      forearmBack: ANTEBRAZO,
      forearmFront: ANTEBRAZO,
    },
    colors: {
      piel: pickFrom(PALETA.piel, appearance.skinColor),
      pelo: pickFrom(PALETA.pelo, appearance.hairColor),
      ropa,
      ropa2: faja,
    },
  };
}

/** Color final de una forma, ya resuelto con la paleta del personaje. */
export const colorOf = (fill: Tinte, colors: Look['colors']): string =>
  fill === 'piel' || fill === 'pelo' || fill === 'ropa' || fill === 'ropa2'
    ? colors[fill]
    : PALETA[fill];

/** El arma en la mano. Las 10 comparten silueta por categoria y varian de largo. */
export function weaponShapes(category: WeaponCategory, reach: number): Shape[] {
  const largo = 0.75 + reach * 0.12;
  return ARMAS[category].map((shape) => ({ ...shape, d: scalePath(shape.d, largo) }));
}

/**
 * Escala solo el eje x de una ruta: alarga el arma sin engordarla.
 *
 * Da por hecho que los numeros van en pares x,y, que es cierto para M/L/Q/Z.
 * En un arco (a/A) no lo es: siete parametros de los que solo dos son un punto.
 * Antes eso corrompia la forma en silencio; ahora revienta al escribirla.
 */
export function scaleForTest(d: string, factor = 2): string {
  return scalePath(d, factor);
}

function scalePath(d: string, factor: number): string {
  if (/[aA]/.test(d)) {
    throw new Error(`scalePath no sabe escalar arcos, y esta ruta lleva uno: ${d}`);
  }
  let index = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (raw) => {
    const value = Number(raw);
    // En una ruta los numeros van por pares x,y salvo en los arcos, que aqui no hay.
    const scaled = index++ % 2 === 0 ? value * factor : value;
    return String(Math.round(scaled * 100) / 100);
  });
}
