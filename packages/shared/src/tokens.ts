/**
 * Tokens de interfaz (ARTE-Y-TOKENS.md §2.2). Un solo sitio para los valores
 * que comparten la interfaz y el arte.
 *
 * La direccion es que manda la paleta del arte: `tinta` es el mismo trazo con
 * el que se dibuja un peleon, y `acento` es uno de los colores que puede llevar
 * puestos. La interfaz deja de ignorar `parts.ts`.
 *
 * Los mismos valores estan como variables CSS en `apps/web/src/styles.css`, y
 * hay un test que falla si las dos listas dejan de coincidir.
 */
export const TOKENS = {
  /** Texto, bordes y contornos. Es el trazo del arte. */
  tinta: '#241f1c',
  /** Texto secundario. */
  tintaSuave: '#4a3b2c',
  /** Fondo de pagina. */
  papel: '#ede3d0',
  /** Superficie de tarjeta. */
  papelClaro: '#f7efdc',
  /** Superficie hundida: panel de retrato, barras, pie. */
  papelHondo: '#e2d3b6',
  /** Barra superior. */
  madera: '#4a2f1c',
  /** Texto sobre madera: marca y enlaces de la barra. */
  oro: '#e4c07a',
  /** Bordes suaves y separadores. */
  linea: '#8a7860',
  /** Acciones principales. */
  acento: '#7a3a3a',
  /** Acento al pasar por encima. */
  acentoHondo: '#5c2b2b',
  /** Victoria en el historial. */
  gana: '#3f5c3f',
  /** Derrota en el historial. */
  pierde: '#7a3a3a',
} as const;

/** Grosor de borde de tarjetas y controles, en px. */
export const BORDE = 2;
/** Esquinas: casi rectas, a juego con el trazo del arte. */
export const RADIO = 3;

/** Trazo y grosor del arte. Viven aqui porque los comparten interfaz y dibujo. */
export const TRAZO = TOKENS.tinta;
export const GROSOR = 3;

/** Escala tipografica, en px (§2.2). El espaciado va en multiplos de 4. */
export const ESCALA = [14, 15, 17, 19, 21, 25, 34, 56] as const;

/**
 * Valores propios del lienzo de combate. Pixi quiere enteros, no cadenas.
 * La linea de suelo y la barra de vida salen de la misma gama que el papel y
 * la ropa: el verde saturado de antes era el unico color chillon del juego.
 */
export const LIENZO = {
  fondo: '#ede3d0',
  suelo: '#c9b894',
  vida: '#5f7245',
} as const;

/** De '#rrggbb' al entero que espera Pixi. */
export const aEntero = (color: string): number => Number.parseInt(color.slice(1), 16);
