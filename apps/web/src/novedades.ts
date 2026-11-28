/**
 * Lo que cambio en cada despliegue, contado para el jugador. Es la unica fuente:
 * la pagina /novedades lo pinta y `pnpm --filter @camorra/web novedades` saca la
 * ultima entrada en Markdown para el release de GitHub.
 *
 * La mas nueva primero. La fecha hace de identificador: dos despliegues el mismo
 * dia comparten entrada.
 *
 * Puro salvo el almacen, que se inyecta para poder probarlo.
 */
export type TipoNovedad = 'nuevo' | 'cambio' | 'arreglo';

export interface Novedad {
  /** `YYYY-MM-DD`. */
  fecha: string;
  puntos: { tipo: TipoNovedad; texto: string }[];
}

export const ETIQUETA: Record<TipoNovedad, string> = {
  nuevo: 'Nuevo',
  cambio: 'Cambio',
  arreglo: 'Arreglo',
};

export const NOVEDADES: readonly Novedad[] = [
  {
    fecha: '2026-11-28',
    puntos: [
      {
        tipo: 'nuevo',
        texto: 'Tres armas nuevas: la Vara de Fresno, la Garrafa de Greda y los Cuchillos de Tiro.',
      },
      {
        tipo: 'cambio',
        texto:
          'Las armas arrojadizas se acaban. La botija y la garrafa revientan en el primer lanzamiento, el cascote trae 3 tiros y los cuchillos 5. Cuando se acaban, tu peleón saca otra arma o sigue a puños.',
      },
      {
        tipo: 'cambio',
        texto:
          'Las armas de mano pueden romperse al golpear. La banqueta es la más frágil y la vara casi no se rompe. Tener varias armas ahora sirve de algo.',
      },
      {
        tipo: 'cambio',
        texto:
          'Desde el nivel 5 se sube más rápido. Tu barra de experiencia puede verse distinta: no pierdes nada de lo que llevas.',
      },
      {
        tipo: 'arreglo',
        texto:
          'Quien muere de un contraataque se queda tendido donde cayó, en vez de volver andando partido en dos.',
      },
    ],
  },
];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Sin `Date`: con zona horaria, el 28 a medianoche UTC se pintaba 27 en Chile. */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${dia} de ${MESES[(mes ?? 1) - 1]} de ${anio}`;
}

export const hayNovedad = (vista: string | null): boolean =>
  NOVEDADES[0] !== undefined && vista !== NOVEDADES[0].fecha;

const CLAVE = 'camorra:novedades-vista';

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/** El almacen puede no existir o lanzar (modo privado, cookies bloqueadas). */
function almacenPorDefecto(): Almacen | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function leerVista(almacen: Almacen | null = almacenPorDefecto()): string | null {
  try {
    return almacen?.getItem(CLAVE) ?? null;
  } catch {
    return null;
  }
}

export function marcarVista(almacen: Almacen | null = almacenPorDefecto()): void {
  const ultima = NOVEDADES[0];
  if (ultima === undefined) return;
  try {
    almacen?.setItem(CLAVE, ultima.fecha);
  } catch {
    // Sin almacen el punto vuelve a salir: molesta poco y no rompe nada.
  }
}

export function aMarkdown(n: Novedad): string {
  const puntos = n.puntos.map((p) => `- **${ETIQUETA[p.tipo]}:** ${p.texto}`).join('\n');
  return `## ${formatearFecha(n.fecha)}\n\n${puntos}\n`;
}
