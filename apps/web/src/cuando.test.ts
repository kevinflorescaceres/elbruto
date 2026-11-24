import { describe, expect, it } from 'vitest';
import { cuando } from './ui.js';

describe('cuando', () => {
  const ahora = new Date(2026, 10, 24, 0, 30); // 24 nov 2026, recien pasada la medianoche

  it('hoy y ayer por dia de calendario, no por 24 horas', () => {
    expect(cuando(new Date(2026, 10, 24, 0, 5).toISOString(), ahora)).toBe('hoy');
    // Hace 40 minutos, pero ya era otro dia.
    expect(cuando(new Date(2026, 10, 23, 23, 50).toISOString(), ahora)).toBe('ayer');
  });

  it('mas atras, fecha corta; el ano solo si no es este', () => {
    expect(cuando(new Date(2026, 10, 2).toISOString(), ahora)).not.toMatch(/2026/);
    expect(cuando(new Date(2025, 11, 31).toISOString(), ahora)).toMatch(/2025/);
  });
});
