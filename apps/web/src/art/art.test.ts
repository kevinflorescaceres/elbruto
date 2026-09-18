import { describe as group, expect, it } from 'vitest';
import { createBrute } from '@camorra/engine';
import {
  lookFrom,
  RIG,
  scaleForTest,
  weaponShapes,
  Z_ORDER,
  type PartName,
  type Shape,
} from './parts.js';
import { ANIMATIONS, REST, type AnimName } from './poses.js';

const PARTES = new Set<PartName>(RIG.map((p) => p.name));

group('rig', () => {
  it('cada parte cuelga de otra que existe, y solo la cadera de nada', () => {
    const vistas = new Set<PartName>();
    for (const part of RIG) {
      if (part.parent === null) expect(part.name).toBe('hips');
      else expect(vistas.has(part.parent)).toBe(true);
      expect(vistas.has(part.name)).toBe(false);
      vistas.add(part.name);
      expect(Number.isFinite(part.at[0])).toBe(true);
      expect(Number.isFinite(part.at[1])).toBe(true);
    }
  });

  it('el orden de pintado solo nombra partes del rig', () => {
    for (const name of Z_ORDER) expect(PARTES.has(name)).toBe(true);
  });
});

group('animaciones', () => {
  const nombres = Object.keys(ANIMATIONS) as AnimName[];

  it('estan las 12 que pide el plan', () => {
    expect(nombres).toEqual([
      'idle',
      'walk',
      'attackRapida',
      'attackPesada',
      'attackLarga',
      'attackArrojadiza',
      'hit',
      'evade',
      'block',
      'throw',
      'death',
      'victory',
    ]);
  });

  it('los keyframes van de 0 a 1 sin retroceder y tocan partes reales', () => {
    for (const name of nombres) {
      const { frames } = ANIMATIONS[name];
      expect(frames.length).toBeGreaterThanOrEqual(2);
      expect(frames[0]?.t).toBe(0);
      expect(frames.at(-1)?.t).toBe(1);

      let previo = -1;
      for (const frame of frames) {
        expect(frame.t).toBeGreaterThan(previo);
        previo = frame.t;

        for (const [part, pose] of Object.entries(frame.parts)) {
          if (!PARTES.has(part as PartName))
            throw new Error(`${name} mueve ${part}, que no existe`);
          for (const value of [pose.rot, pose.x, pose.y]) {
            if (value === undefined) continue;
            expect(Number.isFinite(value)).toBe(true);
          }
          // Mas de una vuelta entera es siempre un error de signo o de unidades.
          if (pose.rot !== undefined) expect(Math.abs(pose.rot)).toBeLessThan(Math.PI);
        }
      }
    }
  });

  it('las que vuelven al reposo terminan donde empiezan', () => {
    // Death y victory acaban en pose final a proposito; el resto debe cerrar.
    for (const name of nombres) {
      if (name === 'death' || name === 'victory') continue;
      const { frames } = ANIMATIONS[name];
      const primero = frames[0]?.parts ?? {};
      const ultimo = frames.at(-1)?.parts ?? {};
      for (const [part, pose] of Object.entries(primero)) {
        expect(ultimo[part as PartName]?.rot ?? 0).toBeCloseTo(pose.rot ?? 0, 5);
      }
    }
  });

  it('el reposo define todas las partes', () => {
    for (const part of PARTES) expect(REST.parts[part]).toBeDefined();
  });
});

group('apariencia', () => {
  it('dos nombres distintos dan peleones visiblemente distintos', () => {
    const nombres = [
      'Chirlo de la Cava',
      'Tuerto del Arrabal',
      'Pelon el Jaque',
      'Mellado de Poniente',
    ];
    const firmas = nombres.map((n) => {
      const look = lookFrom(createBrute(n).appearance);
      return JSON.stringify([look.parts.torso, look.parts.head, look.colors]);
    });
    expect(new Set(firmas).size).toBe(nombres.length);
  });

  it('el mismo nombre da siempre el mismo peleon', () => {
    const a = lookFrom(createBrute('Chirlo de la Cava').appearance);
    const b = lookFrom(createBrute('Chirlo de la Cava').appearance);
    expect(a).toEqual(b);
  });

  it('toda apariencia posible resuelve piezas y colores validos', () => {
    for (let i = 0; i < 500; i++) {
      const look = lookFrom(createBrute(`peleon numero ${i}`).appearance);
      for (const name of Z_ORDER) {
        if (name === 'legBack' || name === 'legFront') continue;
        expect(look.parts[name]?.length ?? 0).toBeGreaterThan(0);
      }
      for (const color of Object.values(look.colors)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

group('armas', () => {
  it('cada categoria da formas y el alcance las alarga', () => {
    for (const categoria of ['rapida', 'pesada', 'larga', 'arrojadiza'] as const) {
      const corta = weaponShapes(categoria, 1);
      const larga = weaponShapes(categoria, 4);
      expect(corta.length).toBeGreaterThan(0);
      expect(corta.length).toBe(larga.length);
      // Misma silueta, mas larga: las rutas no pueden salir iguales.
      expect(corta[0]?.d).not.toBe(larga[0]?.d);
      for (const shape of larga) expect(shape.d).not.toMatch(/NaN/);
    }
  });
});

group('scalePath', () => {
  it('revienta en vez de corromper si la ruta lleva un arco', () => {
    // Los arcos tienen siete parametros y solo dos son un punto: escalarlos por
    // pares deforma la figura sin avisar. Mejor fallar al escribir la pieza.
    expect(() => weaponShapes('rapida', 3)).not.toThrow();
    const conArco: Shape[] = [{ d: 'M 0 0 a 5 5 0 1 0 0.1 0 Z', fill: 'metal' }];
    expect(() => scaleForTest(conArco[0]?.d ?? '')).toThrow(/arcos/);
  });
});
