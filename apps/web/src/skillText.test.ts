import { describe, expect, it } from 'vitest';
import { getSkill, SKILLS } from '@camorra/engine';
import { describeSkill } from './skillText.js';

describe('describeSkill', () => {
  it('describe cada maña del catalogo con una frase acabada en punto', () => {
    for (const skill of SKILLS) {
      const texto = describeSkill(skill);
      expect(texto.length).toBeGreaterThan(10);
      expect(texto.endsWith('.')).toBe(true);
    }
  });

  it('usa los numeros del catalogo y los nombres visibles de las aptitudes', () => {
    expect(describeSkill(getSkill('brazo-de-fragua'))).toBe('+2 de Fuerza.');
    expect(describeSkill(getSkill('callo-viejo'))).toContain('1');
    expect(describeSkill(getSkill('revire'))).toContain('20%');
  });

  it('las activas dicen que son de un solo uso', () => {
    for (const skill of SKILLS.filter((s) => s.type === 'activa')) {
      expect(describeSkill(skill)).toContain('una vez por pelea');
    }
  });
});
