import { describe, expect, it } from 'vitest';
import {
  NOVEDADES,
  aMarkdown,
  formatearFecha,
  hayNovedad,
  leerVista,
  marcarVista,
} from './novedades.js';

function memoria() {
  const datos = new Map<string, string>();
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

const roto = {
  getItem: (): string | null => {
    throw new Error('bloqueado');
  },
  setItem: (): void => {
    throw new Error('bloqueado');
  },
};

describe('novedades', () => {
  it('las entradas tienen fecha ISO unica, van de la mas nueva a la mas vieja y no estan vacias', () => {
    expect(NOVEDADES.length).toBeGreaterThan(0);
    for (const [i, n] of NOVEDADES.entries()) {
      expect(n.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.puntos.length).toBeGreaterThan(0);
      for (const p of n.puntos) expect(p.texto.trim()).not.toBe('');
      const anterior = NOVEDADES[i - 1];
      if (anterior !== undefined) expect(n.fecha < anterior.fecha).toBe(true);
    }
  });

  it('la fecha se escribe en espanol sin correrse de dia', () => {
    expect(formatearFecha('2026-11-28')).toBe('28 de noviembre de 2026');
    expect(formatearFecha('2027-01-01')).toBe('1 de enero de 2027');
  });

  it('hay novedad mientras no se haya visto la ultima entrada', () => {
    expect(hayNovedad(null)).toBe(true);
    expect(hayNovedad('basura')).toBe(true);
    expect(hayNovedad('2000-01-01')).toBe(true);
    expect(hayNovedad(NOVEDADES[0]?.fecha ?? '')).toBe(false);
  });

  it('marcar la vista la guarda y leerla la devuelve', () => {
    const m = memoria();
    expect(leerVista(m)).toBeNull();
    marcarVista(m);
    expect(leerVista(m)).toBe(NOVEDADES[0]?.fecha);
  });

  it('sin almacen, o con uno que lanza, no se rompe nada', () => {
    expect(leerVista(roto)).toBeNull();
    expect(() => marcarVista(roto)).not.toThrow();
    expect(leerVista(null)).toBeNull();
    expect(() => marcarVista(null)).not.toThrow();
  });

  it('aMarkdown da la entrada lista para un release de GitHub', () => {
    expect(
      aMarkdown({
        fecha: '2026-11-28',
        puntos: [
          { tipo: 'nuevo', texto: 'A.' },
          { tipo: 'arreglo', texto: 'B.' },
        ],
      }),
    ).toBe('## 28 de noviembre de 2026\n\n- **Nuevo:** A.\n- **Arreglo:** B.\n');
  });
});
