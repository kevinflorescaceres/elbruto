import { describe as group, expect, it } from 'vitest';
import { appearanceField, clothColor2For, createBrute, fieldSeed } from './brute.js';
import type { Appearance } from './types.js';

/**
 * Caras capturadas ANTES de introducir la semilla por campo (ARTE-Y-TOKENS.md
 * §1.3). Si alguna cambia, es que una tirada nueva se ha colado en el PRNG
 * secuencial y todos los peleones del mundo han cambiado de cara.
 */
const CARAS: [string, Omit<Appearance, 'clothColor2'>][] = [
  ['Chirlo de la Cava', { body: 1, head: 1, hair: 1, skinColor: 2, hairColor: 4, clothColor: 0 }],
  ['Tuerto del Arrabal', { body: 1, head: 0, hair: 2, skinColor: 3, hairColor: 5, clothColor: 3 }],
  ['Pelón el Jaque', { body: 1, head: 1, hair: 2, skinColor: 1, hairColor: 5, clothColor: 4 }],
  ['Mellado de Poniente', { body: 0, head: 0, hair: 3, skinColor: 3, hairColor: 4, clothColor: 2 }],
  ['Zurdo de la Sierpe', { body: 2, head: 2, hair: 3, skinColor: 2, hairColor: 2, clothColor: 1 }],
  ['Bizco de Santa Cruz', { body: 2, head: 3, hair: 5, skinColor: 1, hairColor: 5, clothColor: 3 }],
  ['Rengo el Gallo', { body: 2, head: 1, hair: 1, skinColor: 1, hairColor: 2, clothColor: 6 }],
  ['Manco de la Cava', { body: 2, head: 2, hair: 0, skinColor: 1, hairColor: 1, clothColor: 1 }],
  ['Jaque de Poniente', { body: 0, head: 1, hair: 5, skinColor: 4, hairColor: 3, clothColor: 3 }],
  ['Rufo el Tuerto', { body: 2, head: 3, hair: 1, skinColor: 3, hairColor: 4, clothColor: 5 }],
  ['Caña de la Sierpe', { body: 1, head: 1, hair: 2, skinColor: 3, hairColor: 1, clothColor: 4 }],
  ['Tizón del Arrabal', { body: 1, head: 2, hair: 1, skinColor: 0, hairColor: 3, clothColor: 1 }],
];

group('apariencia', () => {
  it('ningun peleon conocido cambia de cara', () => {
    for (const [nombre, esperada] of CARAS) {
      const {
        clothColor2: _faja,
        brow: _ceja,
        mouth: _boca,
        beard: _barba,
        mark: _marca,
        ...actual
      } = createBrute(nombre).appearance;
      expect(actual, `la cara de ${nombre} ha cambiado`).toEqual(esperada);
    }
  });

  it('los campos por semilla propia no dependen del orden de las tiradas', () => {
    // La prueba de fuego: pedir el campo dos veces, con y sin consumir en medio.
    for (const [nombre] of CARAS) {
      const brute = createBrute(nombre);
      expect(brute.appearance.clothColor2).toBe(clothColor2For(brute.slug));
      expect(appearanceField(brute.slug, 'clothColor2', 7)).toBe(brute.appearance.clothColor2);
    }
  });

  it('cada campo reparte por todo su rango y no se casa con otro', () => {
    const faja = new Set<number>();
    const ropa = new Set<number>();
    let iguales = 0;

    for (let i = 0; i < 800; i++) {
      const b = createBrute(`reparto numero ${i}`);
      faja.add(b.appearance.clothColor2 ?? -1);
      ropa.add(b.appearance.clothColor);
      if (b.appearance.clothColor2 === b.appearance.clothColor) iguales += 1;
    }

    expect(faja.size).toBe(8);
    expect(ropa.size).toBe(8);
    // Independientes: coinciden alrededor de 1 de cada 8, no siempre ni nunca.
    expect(iguales).toBeGreaterThan(40);
    expect(iguales).toBeLessThan(160);
  });

  it('los campos de cara reparten por todo su rango', () => {
    const vistos: Record<string, Set<number>> = {
      brow: new Set(),
      mouth: new Set(),
      beard: new Set(),
      mark: new Set(),
    };
    for (let i = 0; i < 600; i++) {
      const a = createBrute(`cara numero ${i}`).appearance;
      vistos['brow']?.add(a.brow ?? -1);
      vistos['mouth']?.add(a.mouth ?? -1);
      vistos['beard']?.add(a.beard ?? -1);
      vistos['mark']?.add(a.mark ?? -1);
    }
    expect(vistos['brow']?.size).toBe(4);
    expect(vistos['mouth']?.size).toBe(4);
    expect(vistos['beard']?.size).toBe(6);
    expect(vistos['mark']?.size).toBe(6);
  });

  it('un peleon sin los campos guardados los obtiene de su slug, no un valor por defecto', () => {
    // Los ya creados no cambian todos a la misma cara: cada uno saca la suya.
    const caras = new Set<string>();
    for (const [nombre] of CARAS) {
      const b = createBrute(nombre);
      caras.add(
        `${b.appearance.brow}-${b.appearance.mouth}-${b.appearance.beard}-${b.appearance.mark}`,
      );
    }
    expect(caras.size).toBeGreaterThan(CARAS.length / 2);
  });

  it('semillas distintas para campos distintos del mismo peleon', () => {
    expect(fieldSeed('mismo-slug', 'beard')).not.toBe(fieldSeed('mismo-slug', 'mark'));
    expect(fieldSeed('un-slug', 'beard')).not.toBe(fieldSeed('otro-slug', 'beard'));
  });
});
