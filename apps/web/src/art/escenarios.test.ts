import { describe as group, expect, it } from 'vitest';
import { ESCENARIOS, escenarioDe } from './escenarios.js';

/** Caja que ocupa una ruta, leyendo sus numeros por pares x,y. */
function caja(d: string): { x1: number; x2: number; y1: number; y2: number } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

/**
 * Donde se plantan los peleones: 252 y 648, con medio cuerpo a cada lado. A
 * ESCALA_ACTOR 1.45 el rig mide unos 76 px de ancho y 186 de alto, con los pies
 * en 357: la cabeza llega a y = 171.
 */
const COLUMNAS = [
  { x1: 212, x2: 292 },
  { x1: 608, x2: 688 },
];

/** Arriba del todo de un peleon. Por encima de esto el decorado no le tapa. */
const CORONILLA = 171;

/**
 * Franja del marcador: las dos barras de vida y su nombre debajo. Sale de HUD
 * en pixiScene (margen 38, ancho 310, arriba 30) con aire de sobra.
 */
const BARRAS = [
  { x1: 38, x2: 348, y1: 24, y2: 74 },
  { x1: 552, x2: 862, y1: 24, y2: 74 },
];

group('escenarios', () => {
  it('todos tienen piezas y ninguna ruta sale rota', () => {
    expect(ESCENARIOS.length).toBeGreaterThan(0);
    for (const esc of ESCENARIOS) {
      expect(esc.piezas.length, esc.id).toBeGreaterThan(0);
      for (const pieza of esc.piezas) {
        expect(pieza.d, esc.id).not.toMatch(/NaN|undefined/);
        const c = caja(pieza.d);
        for (const v of [c.x1, c.x2, c.y1, c.y2]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('ningun objeto del decorado cruza por delante de un peleon', () => {
    // El fallo que hubo: un poste de la valla caia justo sobre una cara. Los
    // fondos de banda ancha (paredes, suelos) si pueden pasar por ahi.
    for (const esc of ESCENARIOS) {
      for (const pieza of esc.piezas) {
        const c = caja(pieza.d);
        const ancho = c.x2 - c.x1;
        const objeto = ancho < 200;
        const alturaDelCuerpo = c.y2 > CORONILLA && c.y1 < 349;
        if (!objeto || !alturaDelCuerpo) continue;

        for (const col of COLUMNAS) {
          const cruza = c.x1 < col.x2 && c.x2 > col.x1;
          if (cruza) {
            throw new Error(`${esc.id}: una pieza en x ${c.x1}-${c.x2} tapa al peleon`);
          }
        }
      }
    }
  });

  it('ningun adorno cruza una barra de vida', () => {
    // El fallo que hubo: el cordel de un candil bajaba desde el borde superior
    // justo por encima de la barra derecha. Los fondos de banda ancha pasan:
    // van detras y son color plano.
    for (const esc of ESCENARIOS) {
      for (const pieza of esc.piezas) {
        const c = caja(pieza.d);
        if (c.x2 - c.x1 >= 200) continue;

        for (const barra of BARRAS) {
          const cruza =
            c.x1 < barra.x2 && c.x2 > barra.x1 && c.y1 < barra.y2 && c.y2 > barra.y1;
          if (cruza) {
            throw new Error(
              `${esc.id}: una pieza en x ${c.x1}-${c.x2}, y ${c.y1}-${c.y2} tapa el marcador`,
            );
          }
        }
      }
    }
  });

  it('el suelo se distingue de lo que tiene detras', () => {
    // Antes la taberna era de un solo tono y no se veia donde pisaban.
    const luz = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    };

    for (const esc of ESCENARIOS) {
      // La banda ancha que empieza justo en el suelo, y la que la precede.
      const bandas = esc.piezas.filter((p) => {
        const c = caja(p.d);
        return c.x2 - c.x1 >= 200 && p.color !== 'none';
      });
      const suelo = bandas.find((p) => caja(p.d).y1 === 349);
      const fondo = bandas.filter((p) => caja(p.d).y1 < 349).at(-1);
      expect(suelo, `${esc.id}: no hay banda de suelo`).toBeDefined();
      expect(fondo, `${esc.id}: no hay banda de fondo`).toBeDefined();
      if (suelo === undefined || fondo === undefined) continue;

      const salto = Math.abs(luz(suelo.color) - luz(fondo.color));
      expect(salto, `${esc.id}: suelo y fondo casi del mismo tono`).toBeGreaterThan(24);
    }
  });

  it('el escenario sale de la semilla y siempre es valido', () => {
    for (const seed of [0, 1, 7, 12345, 2 ** 30, -5, 999999999]) {
      const i = escenarioDe(seed);
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(ESCENARIOS.length);
    }
    // Determinista: la repeticion de un combate no cambia de sitio.
    expect(escenarioDe(4242)).toBe(escenarioDe(4242));
  });

  it('las cuatro salen con semillas consecutivas', () => {
    const vistos = new Set([0, 1, 2, 3].map((s) => escenarioDe(s)));
    expect(vistos.size).toBe(ESCENARIOS.length);
  });
});
