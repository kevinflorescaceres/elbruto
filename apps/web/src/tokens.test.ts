import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe as group, expect, it } from 'vitest';
import { BORDE, LIENZO, RADIO, TOKENS } from '@camorra/shared';
import { TRAZO } from './art/parts.js';

/**
 * Los tokens viven en dos sitios a proposito: `tokens.ts` para el codigo y
 * variables CSS para la hoja de estilos. Esa duplicacion se desincroniza sola,
 * asi que aqui se comprueba que digan lo mismo.
 */
const css = readFileSync(resolve(import.meta.dirname, 'styles.css'), 'utf8');
const variable = (nombre: string): string | undefined =>
  new RegExp(`--${nombre}:\\s*([^;]+);`).exec(css)?.[1]?.trim();

/** De `tintaSuave` a `--tinta-suave`. */
const aKebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

group('tokens', () => {
  it('cada color de tokens.ts esta en styles.css con el mismo valor', () => {
    for (const [nombre, valor] of Object.entries(TOKENS)) {
      const enCss = variable(aKebab(nombre));
      expect(enCss, `falta --${aKebab(nombre)} en styles.css`).toBeDefined();
      expect(enCss?.toLowerCase(), `--${aKebab(nombre)} no coincide`).toBe(valor.toLowerCase());
    }
  });

  it('el verde de la vida es el mismo en el lienzo y en el marcador', () => {
    // El marcador salio del lienzo al DOM: los dos pintan la misma barra.
    expect(variable('vida')?.toLowerCase()).toBe(LIENZO.vida.toLowerCase());
  });

  it('el borde y el radio tambien coinciden', () => {
    expect(variable('borde')).toBe(`${BORDE}px`);
    expect(variable('radio')).toBe(`${RADIO}px`);
  });

  it('el trazo del arte es el mismo color que la tinta de la interfaz', () => {
    // Es la decision de fondo de §2.2: la interfaz deja de ignorar el arte.
    expect(TRAZO).toBe(TOKENS.tinta);
  });

  it('no queda ningun color a pelo en la hoja de estilos', () => {
    // Todo color debe salir de una variable. Los #rrggbb solo se declaran en :root.
    const raiz = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    const fuera = css.replace(raiz, '');
    const sueltos = fuera.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect(sueltos, `colores sueltos: ${sueltos.join(', ')}`).toEqual([]);
  });
});
