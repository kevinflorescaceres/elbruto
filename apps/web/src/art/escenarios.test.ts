import { describe as group, expect, it } from 'vitest';
import { ESCENARIOS, escenarioDe } from './escenarios.js';

/** Caja que ocupa una ruta, leyendo sus numeros por pares x,y. */
function caja(d: string): { x1: number; x2: number; y1: number; y2: number } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

/** Donde se plantan los peleones: 252 y 648, con medio cuerpo a cada lado. */
const COLUMNAS = [
  { x1: 215, x2: 290 },
  { x1: 611, x2: 686 },
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
        const alturaDelCuerpo = c.y2 > 230 && c.y1 < 349;
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
