import { describe, expect, it } from 'vitest';
import { getSkill, getWeapon, SKILLS } from '@camorra/engine';
import { describeSkill, describeWeapon } from './skillText.js';

describe('describeSkill', () => {
  it('describe cada maña del catalogo con una frase acabada en punto', () => {
    for (const skill of SKILLS) {
      const texto = describeSkill(skill);
      expect(texto.length).toBeGreaterThan(10);
      expect(texto.endsWith('.')).toBe(true);
    }
  });

  it('usa los numeros del catalogo y los nombres visibles de las aptitudes', () => {
    expect(describeSkill(getSkill('resuello'))).toBe(
      'Por debajo del 30% de vida, +12 de Brío el resto de la pelea.',
    );
    expect(describeSkill(getSkill('callo-viejo'))).toContain('Resta 2');
    expect(describeSkill(getSkill('revire'))).toContain('20%');
  });

  it('las activas dicen que son de un solo uso', () => {
    for (const skill of SKILLS.filter((s) => s.type === 'activa')) {
      expect(describeSkill(skill)).toContain('una vez por pelea');
    }
  });
});

describe('describeWeapon', () => {
  it('avisa del stock y de la fragilidad', () => {
    expect(describeWeapon(getWeapon('botija'))).toMatch(/ · un solo uso$/);
    expect(describeWeapon(getWeapon('cuchillos'))).toMatch(/ · 5 lanzamientos$/);
    expect(describeWeapon(getWeapon('banqueta'))).toMatch(/ · frágil$/);
    expect(describeWeapon(getWeapon('chaira'))).toBe('Arma rápida · 6 de daño · muy rápida');
  });
});
