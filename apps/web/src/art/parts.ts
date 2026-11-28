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
import {
  campoDeApariencia,
  clothColor2For,
  type Appearance,
  type WeaponCategory,
} from '@camorra/engine';

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
  | 'trapo'
  | 'lengua';

export interface Shape {
  d: string;
  fill: Tinte;
  /** Sin trazo para los detalles finos, que si no se emborronan. */
  stroke?: false;
  /** Solo linea, de este grosor y sin relleno: cejas, bocas y cicatrices. */
  trazo?: number;
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
  // Solo para el fondo de las bocas abiertas: oscuras del todo se leian como
  // una perilla en las caras sin barba.
  lengua: '#a8443c',
} as const;

// Viven en los tokens compartidos; se reexportan para no romper imports.
export { GROSOR, TRAZO } from '@camorra/shared';

export interface Joint {
  name: PartName;
  parent: PartName | null;
  at: [number, number];
}

/**
 * Articulaciones: donde cuelga cada parte de su padre. Es el rig base; los
 * hombros los mueve cada complexion (ver `Look.rig`), asi que los renderers
 * leen el rig del look y no este.
 */
export const RIG: Joint[] = [
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

/**
 * Z_ORDER da la profundidad, y la forma propia de una parte usa la suya: asi
 * el brazo de atras queda detras del torso y el de delante por encima.
 */
export function profundidad(name: PartName): number {
  const index = Z_ORDER.indexOf(name);
  return index === -1 ? Z_ORDER.indexOf('torso') : index;
}

/** Por encima del torso y por debajo de la cabeza: el brazo de atras en guardia. */
export const Z_DELANTE = Z_ORDER.indexOf('torso') + 0.5;

/** Del hombro al codo y del codo al centro del puno, en unidades del rig. */
export const LARGO_BRAZO = 15;
export const ANTEBRAZO_HASTA_PUNO = 16;

/**
 * Gira un vector como lo gira Pixi: con la y hacia abajo, positivo es horario.
 * Una parte que cuelga (0, L) con rotacion negativa se va hacia +x, delante.
 */
export function girar(x: number, y: number, rot: number): [number, number] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [x * c - y * s, x * s + y * c];
}

/**
 * Si el brazo de atras va por delante del torso, segun su pose y no segun que
 * animacion la puso. El torso esta dibujado de frente: el brazo lejano colgando
 * o echado atras va detras, de lado, pero con el puno subido por delante del
 * hombro (guardia, cruzado, agarre del arma) tapa el pecho.
 *
 * Era un `set` suelto al principio y al final de cada animacion, y como la
 * vuelta de un golpe suena encima del siguiente, el final del primero mandaba
 * el brazo detras justo en el contacto del segundo. Derivarlo de la pose hace
 * imposible que la capa y el gesto se contradigan.
 *
 * `dx` es lo que se ha movido el hombro respecto a su sitio (el cruzado lo
 * adelanta), y las medidas van desde el hombro, asi valen para cualquier
 * complexion.
 */
export function brazoAtrasDelante(dx: number, rotBrazo: number, rotAntebrazo: number): boolean {
  if (dx > 5) return true;
  const [cx, cy] = girar(0, LARGO_BRAZO, rotBrazo);
  const [px, py] = girar(0, ANTEBRAZO_HASTA_PUNO, rotBrazo + rotAntebrazo);
  // Puno por encima de la cintura y por delante del hombro. Al andar el brazo
  // se adelanta, pero estirado: el puno no sube de la cadera.
  return cy + py < LARGO_BRAZO && cx + px > 5;
}

// --- Piezas ---

/**
 * El peleon es FRONTAL: dos ojos, torso simetrico, escote centrado y faja de
 * lado a lado. Por eso cada bota apunta hacia su lado, como en el encargo. Con
 * las dos mirando al mismo sitio el cuerpo se lee girado.
 *
 * Las piernas se abren hacia abajo (`abre` unidades en el tobillo): plantado
 * con los pies separados se lee pendenciero; con las piernas paralelas, de
 * soldadito de plomo.
 */
const pierna = (lado: 'izq' | 'der'): Shape[] => {
  const s = lado === 'izq' ? -2.5 : 2.5;
  const p = (x: number) => x + s;
  // Puntera hacia su lado: en la izquierda se refleja la bota entera.
  const bota =
    lado === 'der'
      ? `M ${p(-5)} 25 L ${p(5)} 25 L ${p(5)} 29 Q ${p(13)} 29 ${p(13)} 34 L ${p(13)} 37 L ${p(-5.5)} 37 Z`
      : `M ${p(5)} 25 L ${p(-5)} 25 L ${p(-5)} 29 Q ${p(-13)} 29 ${p(-13)} 34 L ${p(-13)} 37 L ${p(5.5)} 37 Z`;
  const suela =
    lado === 'der'
      ? `M ${p(-5.5)} 34.5 L ${p(13)} 34.5 L ${p(13)} 37 L ${p(-5.5)} 37 Z`
      : `M ${p(5.5)} 34.5 L ${p(-13)} 34.5 L ${p(-13)} 37 L ${p(5.5)} 37 Z`;
  return [
    // Pantalon con algo de holgura en la rodilla, que no parezca un tubo.
    {
      d: `M -6 -2 L 6 -2 Q ${7 + s * 0.4} 12 ${p(5.5)} 25 L ${p(-5.5)} 25 Q ${-7 + s * 0.4} 12 -6 -2 Z`,
      fill: 'pantalon',
    },
    { d: bota, fill: 'cuero' },
    { d: suela, fill: 'oscuro', stroke: false },
    // Vuelta de la cana de la bota.
    { d: `M ${p(-6.5)} 23 L ${p(6.5)} 23 L ${p(6)} 27 L ${p(-6)} 27 Z`, fill: 'cuero' },
  ];
};

/**
 * Antebrazo grueso arriba y fino en la muneca: el de alguien que trabaja con
 * las manos. Acaba en y=16, donde monta el puno.
 */
const ANTEBRAZO: Shape[] = [
  { d: 'M -4.5 -1 Q -6 5 -4 13 L -3.5 16 L 3.5 16 L 4 13 Q 6 5 4.5 -1 Z', fill: 'piel' },
];

/**
 * El puno: un mazo cuadrado con la raya de los nudillos, no una bola. Centrado
 * en (0,-1), donde estaba el circulo de antes, para que las armas sigan cayendo
 * en la mano.
 */
export const PUNO: Shape[] = [
  {
    d: 'M -5.5 -3.5 Q -5.5 -7 -2 -7 L 2 -7 Q 5.5 -7 5.5 -3.5 L 5.5 1.5 Q 5.5 5 2 5 L -2 5 Q -5.5 5 -5.5 1.5 Z',
    fill: 'piel',
  },
  { d: 'M -3 -2.5 L 3 -2.5', fill: 'oscuro', trazo: 1.4 },
];

/** La mano de atras no lleva arma: el puno va dibujado en el propio antebrazo. */
const ANTEBRAZO_ATRAS: Shape[] = [
  ...ANTEBRAZO,
  ...PUNO.map((shape) => ({ ...shape, d: desplaza(shape.d, 0, 16) })),
];

/**
 * Manga hasta el codo, ancha en el hombro. Una sola pieza: con manga y biceps
 * por separado el brazo se leia como una ristra de salchichas.
 */
const BRAZO: Shape[] = [
  {
    d: 'M -6.5 -1 Q -6.5 -7 0 -7 Q 6.5 -7 6.5 -1 L 5.5 13 Q 5.5 17 0 17 Q -5.5 17 -5.5 13 Z',
    fill: 'ropa',
  },
];

/**
 * Tres complexiones: enjuto, recio y medio. Tienen que distinguirse a
 * golpe de vista, asi que cambian los hombros y la cintura, no un par de
 * unidades. El recio lleva barriga, que asoma por encima de la faja.
 *
 * `cintura` es la media anchura en la faja: la faja se dibuja a su medida y
 * un poco mas ancha que el torso, para que se lea como prenda ceñida.
 */
const COMPLEXIONES: { torso: string; cintura: number; hombro: number }[] = [
  {
    torso: 'M -11 3 Q -12 -12 -15 -22 Q -17 -30 -9 -30 L 9 -30 Q 17 -30 15 -22 Q 12 -12 11 3 Z',
    cintura: 11,
    hombro: 13,
  },
  {
    torso:
      'M -15 3 Q -20 -2 -19 -9 Q -18 -14 -20 -19 Q -23 -30 -13 -31 L 13 -31 Q 23 -30 20 -19 Q 18 -14 19 -9 Q 20 -2 15 3 Z',
    cintura: 15,
    hombro: 20,
  },
  {
    torso: 'M -12 3 Q -13 -9 -18 -19 Q -21 -29 -11 -31 L 11 -31 Q 21 -29 18 -19 Q 13 -9 12 3 Z',
    cintura: 12,
    hombro: 17,
  },
];

const TORSOS: Shape[][] = COMPLEXIONES.map(({ torso, cintura: w }) => [
  { d: torso, fill: 'ropa' },
  // Escote: evita que la cabeza flote sobre un rectangulo.
  { d: 'M -6 -30 L 0 -19 L 6 -30', fill: 'piel' },
  // Faja en `ropa2` para que no desaparezca dentro del jubon.
  { d: `M ${-w - 1.5} -4 L ${w + 1.5} -4 L ${w + 1} 4 L ${-w - 1} 4 Z`, fill: 'ropa2' },
]);

/** Traslada una ruta absoluta. Igual que `scalePath`, no admite arcos. */
function desplaza(d: string, dx: number, dy: number): string {
  if (/[aA]/.test(d)) throw new Error(`desplaza no sabe mover arcos: ${d}`);
  let index = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (raw) => {
    const value = Number(raw);
    const moved = index++ % 2 === 0 ? value + dx : value + dy;
    return String(Math.round(moved * 100) / 100);
  });
}
/**
 * La cabeza. Origen en la base del cuello (el `head` del rig), la altura crece
 * hacia -y. El borde de arriba del torso cae en y=-3.
 *
 * Regla que lo ordena todo: **las cuatro cabezas comparten la calota**, la
 * cupula de y=-26 para arriba. Solo cambian de la sien para abajo (mandibula,
 * pomulos, barbilla). Asi cualquier pelo, y mas adelante cualquier sombrero,
 * se dibuja una vez contra la misma cupula y encaja en las cuatro. Antes cada
 * craneo tenia su propia coronilla y los pelos se salian o se quedaban cortos.
 *
 * Calota: semicupula de anchura ±17 en y=-26 y cima en y=-42.
 */
const CALOTA = 'M -17 -26 Q -17 -42 0 -42 Q 17 -42 17 -26';

/** Circulo como dos arcos, con el centro donde se lee. */
const circulo = (cx: number, cy: number, r: number): string =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

/**
 * Cuello corto y ancho. Sin trazo abajo: va metido en el escote, y una raya
 * ahi lo cortaria del cuerpo. Los lados se trazan aparte.
 */
const CUELLO: Shape[] = [
  { d: 'M -6.5 0 L -6.5 -12 L 6.5 -12 L 6.5 0 Z', fill: 'piel', stroke: false },
  { d: 'M -6.5 -1.5 L -6.5 -10 M 6.5 -1.5 L 6.5 -10', fill: 'oscuro', trazo: 3 },
];

/** Orejas: van detras del craneo, que tapa su mitad de dentro. */
const OREJAS: Shape[] = [
  { d: 'M -15 -27 Q -22 -28 -22 -22 Q -22 -16 -15 -17 Z', fill: 'piel' },
  { d: 'M 15 -27 Q 22 -28 22 -22 Q 22 -16 15 -17 Z', fill: 'piel' },
];

/** Cuatro mandibulas bajo la misma calota: redonda, cuadrada, alargada y de pomulos. */
const CABEZAS: Shape[][] = [
  [{ d: `${CALOTA} Q 17 -7 0 -7 Q -17 -7 -17 -26 Z`, fill: 'piel' }],
  [{ d: `${CALOTA} L 17 -14 Q 17 -7 10 -7 L -10 -7 Q -17 -7 -17 -14 Z`, fill: 'piel' }],
  [
    {
      d: `${CALOTA} Q 16.5 -12 9 -6 Q 4 -3 0 -3 Q -4 -3 -9 -6 Q -16.5 -12 -17 -26 Z`,
      fill: 'piel',
    },
  ],
  [
    {
      d: `${CALOTA} Q 21.5 -19 14 -12 Q 7 -6 0 -6 Q -7 -6 -14 -12 Q -21.5 -19 -17 -26 Z`,
      fill: 'piel',
    },
  ],
];

/**
 * Rasgos. Linea de cejas en y=-28, ojos en -24, nariz en -19, boca en -13: la
 * cara ocupa la franja de -30 a -10, que cabe en las cuatro mandibulas.
 */
const OJOS: Shape[] = [
  { d: circulo(-7, -24, 2.4), fill: 'oscuro', stroke: false },
  { d: circulo(7, -24, 2.4), fill: 'oscuro', stroke: false },
];

/** El ojo izquierdo dibujado una vez y el derecho por espejo. Sin arcos (ver `scalePath`). */
const parDeOjos = (izquierdo: Shape[]): Shape[] => [
  ...izquierdo,
  ...izquierdo.map((s) => ({ ...s, d: scalePath(s.d, -1) })),
];

/**
 * Lo que pone cara a cada momento del combate. Los ojos y la boca son lo unico
 * que cambia: cejas, barba y marcas son del personaje y se quedan, asi que con
 * cualquier gesto se le sigue reconociendo.
 *
 * Todo es trazo grueso o mancha llena, como el resto de la cara: en el lienzo la
 * cabeza mide unos 25 px en un movil y un detalle fino no se ve.
 */
export type Expresion =
  'neutral' | 'parpadeo' | 'dolor' | 'alegria' | 'derrotado' | 'esfuerzo' | 'socarrona';

export const EXPRESIONES: readonly Expresion[] = [
  'neutral',
  'parpadeo',
  'dolor',
  'alegria',
  'derrotado',
  'esfuerzo',
  'socarrona',
];

/** Parpado caido, curvado hacia abajo: relajado, no apretado. */
const OJOS_CERRADOS = parDeOjos([
  { d: 'M -9.8 -23.8 Q -7 -21.6 -4.2 -23.8', fill: 'oscuro', trazo: 2.4 },
]);

/**
 * `> <`: el golpe entra y se aprietan. Las puntas miran al centro. Son los
 * UNICOS ojos apretados: si el esfuerzo tambien entornaba, a 25 px atacante y
 * victima se confundian.
 */
const OJOS_APRETADOS = parDeOjos([
  { d: 'M -9.6 -26.8 L -4.6 -24 L -9.6 -21.2', fill: 'oscuro', trazo: 2.4 },
]);

/** `^ ^`: la risa entera. Curvan al reves que el parpadeo, asi no se confunden. */
const OJOS_RISUENOS = parDeOjos([
  { d: 'M -9.8 -23 Q -7 -26.8 -4.2 -23', fill: 'oscuro', trazo: 2.4 },
]);

/** `x x`: fuera de combate. */
const OJOS_EN_X = parDeOjos([
  { d: 'M -9.6 -26.6 L -4.4 -21.4 M -4.4 -26.6 L -9.6 -21.4', fill: 'oscuro', trazo: 2.3 },
]);

/** Medio cerrados por arriba: la mirada de suficiencia del que se ha librado. */
const OJOS_DE_VUELTA = parDeOjos([
  {
    d: 'M -9.2 -24.6 L -4.8 -24.6 Q -4.8 -21.6 -7 -21.6 Q -9.2 -21.6 -9.2 -24.6 Z',
    fill: 'oscuro',
    stroke: false,
  },
  { d: 'M -10 -24.6 L -4 -24.6', fill: 'oscuro', trazo: 2.4 },
]);

/**
 * Cejas en V, mas cerradas que cualquiera de las del personaje: el esfuerzo se
 * dice con ellas y con los dientes, y los ojos se quedan abiertos. La punta de
 * dentro no baja de -28.8: mas abajo se fundia con la correa del parche, que
 * cruza por -25.5 en ese punto.
 */
const CEJAS_EN_V = parDeOjos([{ d: 'M -10.8 -33.2 L -4.2 -28.8', fill: 'oscuro', trazo: 3 }]);

/**
 * La ceja del lado del rival, enarcada: la suficiencia se dice con ella. Sin
 * ella la socarrona dependia de la media sonrisa, y con bigote no se veia y el
 * peleon parecia dormido. Va en el ojo derecho, el que el parche no tapa.
 */
const CEJA_ENARCADA: Shape[] = [
  { d: 'M 3.8 -29.6 Q 7.2 -34.6 11 -31', fill: 'oscuro', trazo: 2.6 },
];

/*
 * Las bocas abiertas van sin contorno: con el trazo de 3 sumaban tanta mancha
 * bajo la nariz que en las caras lampinas parecian una perilla.
 */

/** `:D`, con la fila de dientes de arriba y la lengua. */
const BOCA_RISA: Shape[] = [
  { d: 'M -8 -16 L 8 -16 Q 8 -5.5 0 -5.5 Q -8 -5.5 -8 -16 Z', fill: 'oscuro', stroke: false },
  { d: 'M -6.4 -15 L 6.4 -15 L 6.1 -13 L -6.1 -13 Z', fill: 'trapo', stroke: false },
  { d: 'M -4.6 -6.8 Q 0 -10.8 4.6 -6.8 Q 0 -6.2 -4.6 -6.8 Z', fill: 'lengua', stroke: false },
];

/** Abierta y mas ancha abajo: el quejido, con dientes arriba y lengua. */
const BOCA_QUEJIDO: Shape[] = [
  { d: 'M -4.4 -16 L 4.4 -16 L 7.8 -8.2 L -7.8 -8.2 Z', fill: 'oscuro', stroke: false },
  { d: 'M -3.6 -15 L 3.6 -15 L 4.3 -13.2 L -4.3 -13.2 Z', fill: 'trapo', stroke: false },
  { d: 'M -5.6 -9 Q 0 -12.2 5.6 -9 Z', fill: 'lengua', stroke: false },
];

/** Linea temblona: KO. */
const BOCA_ONDA: Shape[] = [
  { d: 'M -5.5 -12 Q -2.75 -14.6 0 -12 Q 2.75 -9.4 5.5 -12', fill: 'oscuro', trazo: 2.4 },
];

/** Dientes apretados: franja clara dentro de la boca oscura. */
const BOCA_DIENTES: Shape[] = [
  { d: 'M -6.6 -15.6 L 6.6 -15.6 L 6.6 -10 L -6.6 -10 Z', fill: 'oscuro', stroke: false },
  { d: 'M -5.2 -14.2 L 5.2 -14.2 L 5.2 -11.6 L -5.2 -11.6 Z', fill: 'trapo', stroke: false },
];

/**
 * Media sonrisa hacia el rival (+x), con el hoyuelo en la punta: el que esquiva
 * no se asusta, se rie del que ha fallado.
 */
const BOCA_DE_LADO: Shape[] = [
  { d: 'M -5 -12 Q 1 -10.4 5.6 -14.6', fill: 'oscuro', trazo: 2.6 },
  { d: 'M 4.6 -15.8 L 6.8 -13.6', fill: 'oscuro', trazo: 2.2 },
];

/**
 * Piel bajo el ojo derecho para las marcas que lo cruzan (el chirlo): sin ella,
 * la cicatriz se enredaba con la `x`, el `<` o el anillo y no se leia ninguno.
 */
const CLARO_DEL_OJO: Shape[] = [{ d: circulo(7, -24, 3.4), fill: 'piel', stroke: false }];

/**
 * Nariz: solo la linea de abajo, como las cejas y la boca. Rellena y con
 * contorno se comia la cara y se leia como un hocico.
 */
const NARIZ: Shape[] = [{ d: 'M -2.5 -18.5 Q 0 -16.5 2.5 -18.5', fill: 'oscuro', trazo: 2.2 }];

/** Cuatro cejas: recta, caida, arqueada y partida por cicatriz. */
const CEJAS: Shape[][] = [
  [
    { d: 'M -10.5 -28.5 L -4 -28.5', fill: 'oscuro', trazo: 2.4 },
    { d: 'M 10.5 -28.5 L 4 -28.5', fill: 'oscuro', trazo: 2.4 },
  ],
  [
    { d: 'M -10.5 -30.5 L -4 -27.5', fill: 'oscuro', trazo: 2.4 },
    { d: 'M 10.5 -30.5 L 4 -27.5', fill: 'oscuro', trazo: 2.4 },
  ],
  [
    { d: 'M -10.5 -27.5 Q -7.25 -32 -4 -27.5', fill: 'oscuro', trazo: 2.4 },
    { d: 'M 10.5 -27.5 Q 7.25 -32 4 -27.5', fill: 'oscuro', trazo: 2.4 },
  ],
  [
    { d: 'M -10.5 -28.5 L -8 -28.5 M -6.5 -29.5 L -4 -29.5', fill: 'oscuro', trazo: 2.4 },
    { d: 'M 10.5 -28.5 L 4 -28.5', fill: 'oscuro', trazo: 2.4 },
  ],
];

/** Cuatro bocas: sonrisa, torcida, apretada y mellada. */
const BOCAS: Shape[][] = [
  [{ d: 'M -5 -13 Q 0 -9.5 5 -13', fill: 'oscuro', trazo: 2.4 }],
  [{ d: 'M -5 -12 Q 0 -10.5 5 -15', fill: 'oscuro', trazo: 2.4 }],
  [{ d: 'M -5.5 -12.5 L 5.5 -12.5', fill: 'oscuro', trazo: 2.4 }],
  [
    { d: 'M -5 -14.5 L 5 -14.5 L 5 -10.5 L -5 -10.5 Z', fill: 'oscuro' },
    { d: 'M -1 -14.5 L 1.5 -14.5 L 1.5 -12.5 L -1 -12.5 Z', fill: 'trapo', stroke: false },
  ],
];

/**
 * Seis barbas. La primera es no llevar. Las que tapan la mandibula son algo
 * mas anchas que la mas ancha de las cuatro, para cubrirlas todas sin que
 * asome una esquina de la cuadrada.
 */
const BARBAS: Shape[][] = [
  [],
  [{ d: 'M -3 -10 L 3 -10 L 2.5 -1 Q 0 2 -2.5 -1 Z', fill: 'pelo' }],
  [{ d: 'M -8.5 -15 Q 0 -19 8.5 -15 Q 5 -13 0 -14.5 Q -5 -13 -8.5 -15 Z', fill: 'pelo' }],
  [
    // Sin contorno y pegadas al borde de dentro de la cara: con trazo propio
    // parecian unos auriculares.
    { d: 'M -16 -31 L -12 -31 L -12.5 -15.5 Q -14.5 -17 -16 -20 Z', fill: 'pelo', stroke: false },
    { d: 'M 16 -31 L 12 -31 L 12.5 -15.5 Q 14.5 -17 16 -20 Z', fill: 'pelo', stroke: false },
  ],
  [
    {
      d: 'M -18 -22 L -18 -12 Q -17 -1 0 -1 Q 17 -1 18 -12 L 18 -22 Q 12 -9.5 0 -9.5 Q -12 -9.5 -18 -22 Z',
      fill: 'pelo',
    },
  ],
  [
    {
      d: 'M -18.5 -24 L -18.5 -11 Q -18 5 0 8 Q 18 5 18.5 -11 L 18.5 -24 Q 12 -10 0 -10 Q -12 -10 -18.5 -24 Z',
      fill: 'pelo',
    },
  ],
];

/**
 * Seis marcas, tres vacias: si la mitad no lleva, deja de ser una marca.
 *
 * Cada marca dice en que capa va. Lo que esta EN la piel (el chirlo) se pinta
 * antes que el pelo, asi el nacimiento de cada peinado lo corta por donde toca
 * y nunca queda encima del pelo. Lo que se LLEVA PUESTO (parche, venda) va
 * despues de los ojos, para tapar el ojo y pasar por encima del pelo.
 */
const MARCAS: { enLaPiel: Shape[]; puesta: Shape[] }[] = [
  { enLaPiel: [], puesta: [] },
  { enLaPiel: [], puesta: [] },
  { enLaPiel: [], puesta: [] },
  { enLaPiel: [{ d: 'M 10 -34 L 5.5 -17', fill: 'oscuro', trazo: 2.6 }], puesta: [] },
  {
    enLaPiel: [],
    puesta: [
      { d: 'M -18 -28 L 17.5 -24', fill: 'oscuro', trazo: 2.6 },
      { d: circulo(-7, -24, 5), fill: 'oscuro' },
    ],
  },
  {
    enLaPiel: [],
    puesta: [{ d: 'M -18.5 -37 L 18.5 -35 L 18.5 -29.5 L -18.5 -31.5 Z', fill: 'trapo' }],
  },
];

/**
 * Un peinado en tres capas:
 *
 * - `detras`: lo que cae por detras del craneo (melena, coleta). Se pinta
 *   antes que la cabeza, asi enmarca la cara en vez de taparla.
 * - `encima`: lo que va sobre la calota.
 * - `bajoSombrero`: lo que se ve de `encima` si la cabeza lleva sombrero
 *   (patillas, laterales). Lo de `detras` se ve siempre.
 *
 * Todo se dibuja contra la `CALOTA` comun.
 */
export interface Peinado {
  detras: Shape[];
  encima: Shape[];
  bajoSombrero: Shape[];
}

/** Seis pelos: rapado, grenas, cresta, melena, entradas con coleta y calvo con corona. */
const PELOS: Peinado[] = [
  {
    detras: [],
    encima: [
      {
        d: 'M -18 -26 Q -18.5 -43.5 0 -43.5 Q 18.5 -43.5 18 -26 L 16 -27.5 Q 15 -35 0 -35 Q -15 -35 -16 -27.5 Z',
        fill: 'pelo',
      },
    ],
    bajoSombrero: [],
  },
  {
    detras: [],
    encima: [
      {
        d: 'M -19 -22 Q -20 -44.5 0 -44.5 Q 20 -44.5 19 -22 Q 17 -28 14.5 -26 Q 13 -34 9 -31 Q 5 -36 1 -32 Q -3 -36 -7 -31 Q -11 -35 -14 -27 Q -16.5 -29 -19 -22 Z',
        fill: 'pelo',
      },
    ],
    bajoSombrero: [
      { d: 'M -19 -22 L -19 -32 L -15 -32 L -14 -27 Q -16.5 -29 -19 -22 Z', fill: 'pelo' },
      { d: 'M 19 -22 L 19 -32 L 15 -32 L 14.5 -26 Q 17 -28 19 -22 Z', fill: 'pelo' },
    ],
  },
  {
    detras: [],
    encima: [
      { d: 'M -4.5 -42 L 4.5 -42 L 3.5 -34 L -3.5 -34 Z', fill: 'pelo' },
      { d: 'M -5 -41 Q -9 -51 0 -55 Q 9 -51 5 -41 Q 0 -43 -5 -41 Z', fill: 'pelo' },
    ],
    bajoSombrero: [],
  },
  {
    detras: [
      {
        d: 'M -20 -26 Q -21 -45.5 0 -45.5 Q 21 -45.5 20 -26 L 22 -1 Q 16 1 13.5 -6 L -13.5 -6 Q -16 1 -22 -1 Z',
        fill: 'pelo',
      },
    ],
    encima: [
      {
        d: 'M -18.5 -25 Q -19 -44.5 0 -44.5 Q 19 -44.5 18.5 -25 Q 16 -36 2 -36.5 L 0 -34 L -2 -36.5 Q -16 -36 -18.5 -25 Z',
        fill: 'pelo',
      },
    ],
    bajoSombrero: [],
  },
  {
    detras: [{ d: 'M 13 -37 Q 29 -38 27 -21 Q 26 -14 22 -11 Q 21 -21 14 -28 Z', fill: 'pelo' }],
    encima: [
      {
        d: 'M -18 -29 Q -17.5 -43.5 0 -43.5 Q 17.5 -43.5 18 -29 Q 13.5 -35 9.5 -34 Q 7 -39.5 0 -39.5 Q -7 -39.5 -9.5 -34 Q -13.5 -35 -18 -29 Z',
        fill: 'pelo',
      },
    ],
    bajoSombrero: [],
  },
  {
    detras: [],
    encima: [
      { d: 'M -18.5 -22 Q -19.5 -32 -16 -35.5 Q -15 -28 -12.5 -24 Z', fill: 'pelo' },
      { d: 'M 18.5 -22 Q 19.5 -32 16 -35.5 Q 15 -28 12.5 -24 Z', fill: 'pelo' },
    ],
    bajoSombrero: [
      { d: 'M -18.5 -22 Q -19.5 -32 -16 -35.5 Q -15 -28 -12.5 -24 Z', fill: 'pelo' },
      { d: 'M 18.5 -22 Q 19.5 -32 16 -35.5 Q 15 -28 12.5 -24 Z', fill: 'pelo' },
    ],
  },
];

/**
 * El hueco de un sombrero: todo lo que vaya por encima de y=-31 y dentro de
 * ±21 lo puede tapar. Un sombrero nuevo se dibuja contra la `CALOTA` con el
 * ala en esa linea, y el pelo pasa a pintar `bajoSombrero` en vez de `encima`.
 */
export const LINEA_DEL_SOMBRERO = -31;

/** Los rasgos de la cabeza que salen de la apariencia. */
export interface Rasgos {
  head: number;
  hair: number;
  beard: number;
  brow: number;
  mouth: number;
  mark: number;
}

/**
 * Monta la cabeza en su orden de pintado. Con `sombrero`, el pelo pinta solo
 * lo que asoma bajo el ala y el sombrero va encima de todo menos de la marca
 * (una venda o un parche se llevan por debajo... salvo que el ala los tape).
 */
export function montarCabeza(
  r: Rasgos,
  sombrero?: Shape[],
  expresion: Expresion = 'neutral',
): Shape[] {
  const capas = cabezaPorCapas(r, sombrero);
  return [...capas.debajo, ...capas.caras[expresion], ...capas.encima];
}

/**
 * La cabeza partida en tres para poder cambiarle la cara sin rehacerla: el rig
 * de Pixi monta todas las caras de antemano y solo enciende una.
 */
export interface CabezaPorCapas {
  /** Del cuello al pelo. */
  debajo: Shape[];
  /** Cejas (en las que las llevan), ojos y boca de cada expresion. */
  caras: Record<Expresion, Shape[]>;
  /** Lo que se lleva puesto: tapa la cara, sea cual sea. */
  encima: Shape[];
}

export function cabezaPorCapas(r: Rasgos, sombrero?: Shape[]): CabezaPorCapas {
  const pelo = pickFrom(PELOS, r.hair);
  const marca = pickFrom(MARCAS, r.mark);
  const boca = pickFrom(BOCAS, r.mouth);
  const cejas = pickFrom(CEJAS, r.brow);
  const claro = marca.enLaPiel.length > 0 ? CLARO_DEL_OJO : [];
  return {
    debajo: [
      ...CUELLO,
      ...pelo.detras,
      ...OREJAS,
      ...pickFrom(CABEZAS, r.head),
      // La barba antes que el pelo para que las patillas queden bajo la melena.
      ...pickFrom(BARBAS, r.beard),
      ...NARIZ,
      ...marca.enLaPiel,
      ...(sombrero === undefined ? pelo.encima : pelo.bajoSombrero),
    ],
    // Con el gesto tranquilo la boca es la suya; los demas la cambian.
    //
    // Las cejas van con la cara y no con la cabeza porque algunos gestos no las
    // llevan: en `> <`, `x x` y `^ ^` los ojos ya lo dicen todo, y las cejas del
    // personaje les llevaban la contraria (con las caidas, el ganador sonreia
    // con cara de enfado). El esfuerzo cambia las suyas por unas en V.
    caras: {
      neutral: [...claro, ...cejas, ...OJOS, ...boca],
      parpadeo: [...claro, ...cejas, ...OJOS_CERRADOS, ...boca],
      dolor: [...claro, ...OJOS_APRETADOS, ...BOCA_QUEJIDO],
      alegria: [...claro, ...OJOS_RISUENOS, ...BOCA_RISA],
      derrotado: [...claro, ...OJOS_EN_X, ...BOCA_ONDA],
      esfuerzo: [...claro, ...CEJAS_EN_V, ...OJOS, ...BOCA_DIENTES],
      // La ceja izquierda es la suya; la derecha, enarcada.
      socarrona: [
        ...claro,
        ...cejas.slice(0, 1),
        ...CEJA_ENARCADA,
        ...OJOS_DE_VUELTA,
        ...BOCA_DE_LADO,
      ],
    },
    // Tras los ojos, para que el parche tape el ojo y no al reves.
    encima: [...marca.puesta, ...(sombrero ?? [])],
  };
}

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
  /** La cabeza de `parts` lleva la cara neutral; `cabeza` trae todas. */
  parts: Partial<Record<PartName, Shape[]>>;
  cabeza: CabezaPorCapas;
  /** El rig con los hombros de esta complexion. */
  rig: Joint[];
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
  const ropa = pickFrom(PALETA.ropa, appearance.clothColor);
  // Si la faja sale del mismo color que el jubon, desaparece dentro: se coge la
  // siguiente de la lista (ARTE-Y-TOKENS.md §1.6).
  const iFaja = appearance.clothColor2 ?? clothColor2For(slug);
  const faja =
    pickFrom(PALETA.ropa, iFaja) === ropa
      ? pickFrom(PALETA.ropa, iFaja + 1)
      : pickFrom(PALETA.ropa, iFaja);

  const { hombro } = pickFrom(COMPLEXIONES, appearance.body);
  const rig = RIG.map((joint): Joint => {
    if (joint.name === 'armFront') return { ...joint, at: [hombro, joint.at[1]] };
    if (joint.name === 'armBack') return { ...joint, at: [-hombro, joint.at[1]] };
    return joint;
  });

  const cabeza = cabezaPorCapas({
    head: appearance.head,
    hair: appearance.hair,
    beard: appearance.beard ?? campoDeApariencia(slug, 'beard'),
    brow: appearance.brow ?? campoDeApariencia(slug, 'brow'),
    mouth: appearance.mouth ?? campoDeApariencia(slug, 'mouth'),
    mark: appearance.mark ?? campoDeApariencia(slug, 'mark'),
  });

  return {
    rig,
    cabeza,
    parts: {
      torso: pickFrom(TORSOS, appearance.body),
      head: [...cabeza.debajo, ...cabeza.caras.neutral, ...cabeza.encima],
      legBack: pierna('izq'),
      legFront: pierna('der'),
      armBack: BRAZO,
      armFront: BRAZO,
      forearmBack: ANTEBRAZO_ATRAS,
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

/** El arma en la mano. Todas comparten silueta por categoria y varian de largo. */
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
