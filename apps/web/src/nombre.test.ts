import { describe, expect, it } from 'vitest';
import { NAME_MIN } from '@camorra/shared';
import { ayudaNombre } from './nombre.js';

describe('ayudaNombre', () => {
  it('explica la regla antes de escribir, sin dejar crear', () => {
    const a = ayudaNombre('');
    expect(a.valido).toBe(false);
    expect(a.texto).toContain(`De ${NAME_MIN} a`);
  });

  it('cuenta lo que falta, en singular y en plural', () => {
    expect(ayudaNombre('x'.repeat(NAME_MIN - 1)).texto).toBe('Te falta 1 letra.');
    expect(ayudaNombre('x'.repeat(NAME_MIN - 2)).texto).toBe('Te faltan 2 letras.');
  });

  it('marca como error un caracter que el servidor rechazaria, y dice cual', () => {
    expect(ayudaNombre('Ana!')).toMatchObject({ tipo: 'error', valido: false });
    expect(ayudaNombre("O'Brien").texto).toMatch(/^«'» no vale/);
  });

  it('trata un nombre de solo espacios como error, no como campo vacio', () => {
    expect(ayudaNombre('   ')).toMatchObject({ tipo: 'error', valido: false });
    expect(ayudaNombre('').tipo).toBe('info');
  });

  it('deja crear un nombre corto corriente, con tildes', () => {
    expect(ayudaNombre('Ana').valido).toBe(true);
    expect(ayudaNombre('Íñigo Ruiz').valido).toBe(true);
  });
});
