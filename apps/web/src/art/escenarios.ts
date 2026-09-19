/**
 * Fondos de combate. Arte original de este proyecto, en el mismo registro que
 * los peleones: color plano, trazo grueso y poca cosa, para que la pelea siga
 * siendo lo que se mira.
 *
 * Coordenadas del LIENZO (1440 x 420), no del peleon. El suelo esta en y = 349.
 * El lienzo es ancho porque la ventana de combate ocupa todo el eje X de la
 * pagina: en pantalla estrecha se recortan los lados, nunca el alto.
 */

export interface Pieza {
  d: string;
  color: string;
  /** Contorno. La mayoria del decorado no lo lleva: es fondo, no figura. */
  trazo?: { color: string; grosor: number };
}

export interface Escenario {
  id: string;
  nombre: string;
  piezas: Pieza[];
}

const SUELO = 349;
/**
 * Los peleones se plantan en x = 540 y x = 900, centrados en el lienzo. Nada
 * vertical puede caer en esas columnas o el decorado les cruza por delante de
 * la cara. El marcador ya no vive aqui: va en HTML, encima del lienzo.
 */
const ANCHO = 1440;
const ALTO = 420;

/** Gama del decorado, de la misma familia que los tokens. */
const C = {
  tablaClara: '#c9a877',
  tablaMedia: '#b08e5e',
  tablaOscura: '#8a6a44',
  sueloClaro: '#a98a62',
  sueloOscuro: '#6f5638',
  // El suelo va SIEMPRE mas oscuro que lo que tiene detras. Antes compartian
  // valor y la taberna salia de un solo tono, sin horizonte.
  sueloTabla: '#6b5236',
  sueloPiedra: '#7f7260',
  sueloPaja: '#a98a45',
  vetaClara: '#9c7d52',
  yeso: '#d9c9a6',
  yesoSombra: '#c2ae86',
  piedra: '#9a8b73',
  noche: '#3a3b4a',
  cielo: '#cfd3c4',
  agua: '#6a7f86',
  paja: '#c4a75c',
  oscuro: '#241f1c',
  brasa: '#c98a3c',
} as const;

const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  trazo?: Pieza['trazo'],
): Pieza => ({
  d: `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`,
  color,
  ...(trazo === undefined ? {} : { trazo }),
});

const linea = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  grosor: number,
): Pieza => ({
  d: `M ${x1} ${y1} L ${x2} ${y2}`,
  color: 'none',
  trazo: { color, grosor },
});

/** Taberna: tablas, un tonel y un candil. */
const taberna: Escenario = {
  id: 'taberna',
  nombre: 'Taberna',
  piezas: [
    rect(0, 0, ANCHO, SUELO, C.tablaMedia),
    ...[70, 140, 210, 280].map((y) => linea(0, y, ANCHO, y, C.tablaOscura, 3)),
    // Tonel a la izquierda, con los costados abombados: con lados rectos se leia
    // como el marco de un cuadro.
    {
      d: 'M 92 236 L 168 236 Q 182 292 168 349 L 92 349 Q 78 292 92 236 Z',
      color: C.tablaClara,
      trazo: { color: C.oscuro, grosor: 4 },
    },
    linea(82, 268, 178, 268, C.tablaOscura, 5),
    linea(80, 320, 180, 320, C.tablaOscura, 5),
    // Candil colgando, en el hueco central: a los lados cruzaba una barra de vida.
    linea(720, 0, 720, 62, C.oscuro, 4),
    {
      d: 'M 700 62 L 740 62 L 748 96 L 692 96 Z',
      color: C.brasa,
      trazo: { color: C.oscuro, grosor: 4 },
    },
    rect(0, SUELO, ANCHO, ALTO - SUELO, C.sueloTabla),
    ...[180, 480, 780, 1080, 1340].map((x) => linea(x, SUELO, x, ALTO, C.vetaClara, 3)),
  ],
};

/** Callejon: tapia de yeso, una ventana y el cielo de noche por encima. */
const callejon: Escenario = {
  id: 'callejon',
  nombre: 'Callejón',
  piezas: [
    rect(0, 0, ANCHO, 96, C.noche),
    rect(0, 96, ANCHO, SUELO - 96, C.yeso),
    linea(0, 96, ANCHO, 96, C.oscuro, 5),
    // Desconchones.
    rect(160, 150, 90, 60, C.yesoSombra),
    rect(1120, 240, 120, 66, C.yesoSombra),
    // Ventana con reja.
    rect(700, 140, 110, 90, C.noche, { color: C.oscuro, grosor: 5 }),
    ...[730, 755, 780].map((x) => linea(x, 140, x, 230, C.oscuro, 4)),
    rect(0, SUELO, ANCHO, ALTO - SUELO, C.sueloPiedra),
    ...[140, 400, 660, 920, 1180, 1400].map((x) => linea(x, SUELO, x - 20, ALTO, C.piedra, 3)),
  ],
};

/** Corral: cielo abierto, valla de estacas y paja. */
const corral: Escenario = {
  id: 'corral',
  nombre: 'Corral',
  piezas: [
    rect(0, 0, ANCHO, SUELO, C.cielo),
    // Valla: travesanos y estacas.
    rect(0, 196, ANCHO, 14, C.tablaOscura),
    rect(0, 262, ANCHO, 14, C.tablaOscura),
    ...[60, 300, 640, 1000, 1300].map((x) =>
      rect(x, 160, 16, 189, C.tablaClara, { color: C.oscuro, grosor: 3 }),
    ),
    rect(0, SUELO, ANCHO, ALTO - SUELO, C.sueloPaja),
    ...[120, 340, 560, 780, 1000, 1220, 1400].map((x) =>
      linea(x, SUELO + 22, x + 44, SUELO + 14, C.tablaOscura, 3),
    ),
  ],
};

/** Puerto: agua, cajones y un mastil. */
const puerto: Escenario = {
  id: 'puerto',
  nombre: 'Puerto',
  piezas: [
    rect(0, 0, ANCHO, 196, C.cielo),
    rect(0, 196, ANCHO, 92, C.agua),
    linea(0, 196, ANCHO, 196, C.oscuro, 4),
    ...[220, 248, 276].map((y) => linea(0, y, ANCHO, y, C.piedra, 3)),
    // Tablado del muelle: sin esto parecen plantados dentro del agua.
    rect(0, 288, ANCHO, SUELO - 288, C.tablaMedia),
    linea(0, 288, ANCHO, 288, C.oscuro, 4),
    // Mastil al fondo, en el hueco entre las dos barras de vida.
    rect(700, 40, 12, 156, C.tablaOscura),
    { d: 'M 712 56 L 808 94 L 712 126 Z', color: C.yeso, trazo: { color: C.oscuro, grosor: 4 } },
    // Cajones apilados.
    // Apoyados en el tablado (288), no flotando sobre el agua.
    rect(78, 292, 80, 57, C.tablaClara, { color: C.oscuro, grosor: 4 }),
    rect(94, 246, 58, 46, C.tablaMedia, { color: C.oscuro, grosor: 4 }),
    rect(1240, 292, 80, 57, C.tablaClara, { color: C.oscuro, grosor: 4 }),
    rect(0, SUELO, ANCHO, ALTO - SUELO, C.sueloTabla),
    ...[180, 480, 780, 1080, 1340].map((x) => linea(x, SUELO, x, ALTO, C.vetaClara, 3)),
  ],
};

export const ESCENARIOS: readonly Escenario[] = [taberna, callejon, corral, puerto];

/**
 * Cual toca. Sale de la semilla del combate, que ya esta guardada, asi que una
 * repeticion siempre enseña el mismo sitio y no hace falta migrar nada.
 */
export const escenarioDe = (seed: number): number => Math.abs(Math.trunc(seed)) % ESCENARIOS.length;
