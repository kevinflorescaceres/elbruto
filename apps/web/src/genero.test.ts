import { describe, expect, it } from 'vitest';
import { segun } from './genero.js';

describe('segun', () => {
  it('elige la forma de mujer solo si es mujer', () => {
    expect(segun('female', 'peleón', 'peleona')).toBe('peleona');
    expect(segun('male', 'peleón', 'peleona')).toBe('peleón');
    expect(segun(undefined, 'peleón', 'peleona')).toBe('peleón');
  });
});
