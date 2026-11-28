import { describe as group, expect, it } from 'vitest';
import { createBrute } from '@camorra/engine';
import {
  ANTEBRAZO_HASTA_PUNO,
  brazoAtrasDelante,
  cabezaPorCapas,
  EXPRESIONES,
  girar,
  LARGO_BRAZO,
  lookFrom,
  montarCabeza,
  PALETA,
  RIG,
  scaleForTest,
  weaponShapes,
  Z_ORDER,
  type PartName,
  type Rasgos,
  type Shape,
} from './parts.js';
import { animacion, ANIMATIONS, REST, type AnimName, type Frame, type Pose } from './poses.js';

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

  it('estan las 12 que pide el plan, mas el cruzado del uno-dos', () => {
    expect(nombres).toEqual([
      'idle',
      'walk',
      'attackRapida',
      'attackPesada',
      'attackLarga',
      'attackArrojadiza',
      'attackCruzado',
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

  it('un ataque parado apunta a la guardia y rebota, y acaba en reposo', () => {
    for (const name of nombres) {
      const base = ANIMATIONS[name];
      const parado = animacion(name, { parada: true });
      if (base.contacto === undefined) {
        expect(parado).toBe(base);
        continue;
      }
      expect(parado.contacto).toBe(base.contacto);
      const i = base.frames.findIndex((f) => f.t === base.contacto);
      const pega = base.brazo ?? 'armFront';
      const brazo = (a: typeof base, j: number): number =>
        a.frames[j]?.parts[pega]?.rot ?? Number.NaN;
      // Mas abajo que el golpe que entra (positivo = hacia abajo y atras)...
      expect(brazo(parado, i)).toBeGreaterThan(brazo(base, i));
      // ...y despues del contacto vuelve hacia atras en vez de congelarse.
      expect(brazo(parado, i + 1)).toBeGreaterThan(brazo(parado, i));
      expect(parado.frames.at(-1)).toEqual(base.frames.at(-1));
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

  it('un golpe encadenado arranca donde este, guarda el hit-stop y no baja la guardia', () => {
    for (const name of nombres) {
      const base = ANIMATIONS[name];
      if (base.contacto === undefined) continue;
      const seguido = animacion(name, { encadena: true });
      // Sin frame de partida: fijar los brazos a 0 los hacia saltar entre impactos.
      expect(seguido.frames[0]?.parts).toEqual({});
      // La carga no empieza en el contacto anterior, o se come su hit-stop.
      expect(seguido.frames[1]?.parts).toEqual({});
      expect(seguido.frames[1]?.t).toBeGreaterThan(0);
      // El contacto cae donde caia: la linea de tiempo estira con el.
      expect(seguido.contacto).toBe(base.contacto);
      expect(seguido.frames.find((f) => f.t === base.contacto)).toBeDefined();
      expect(seguido.frames.at(-1)).toEqual(base.frames.at(-1));
    }
  });

  it('en los ataques el brazo que no pega sube en guardia y vuelve a su sitio', () => {
    for (const name of nombres) {
      const base = ANIMATIONS[name];
      if (base.contacto === undefined) continue;
      const libre = base.brazo === 'armBack' ? 'armFront' : 'armBack';
      const i = base.frames.findIndex((f) => f.t === base.contacto);
      // En el contacto, levantado hacia delante (rot negativa), no colgando...
      expect(base.frames[i]?.parts[libre]?.rot ?? 0).toBeLessThan(0);
      // ...y al acabar, otra vez colgando y detras del torso.
      expect(base.frames.at(-1)?.parts[libre]?.rot).toBe(0);
      if (libre !== 'armBack') continue;
      const enGuardia = base.frames[i]?.parts;
      expect(
        brazoAtrasDelante(0, enGuardia?.armBack?.rot ?? 0, enGuardia?.forearmBack?.rot ?? 0),
      ).toBe(true);
    }
  });

  it('la capa del brazo de atras sale de su pose: delante en guardia, detras colgando', () => {
    // Guardia y recogida: el puno sube por delante del pecho.
    expect(brazoAtrasDelante(0, -0.45, -1.75)).toBe(true);
    expect(brazoAtrasDelante(0, -0.15, -2.05)).toBe(true);
    // El cruzado adelanta el hombro: delante aunque el brazo vaya estirado.
    expect(brazoAtrasDelante(30, -1.3, -0.05)).toBe(true);
    // Colgando, al andar (brazo estirado hacia delante), cargando el cruzado
    // (echado atras) o en la V de la victoria: detras.
    expect(brazoAtrasDelante(0, 0, 0)).toBe(false);
    expect(brazoAtrasDelante(0, -0.35, 0)).toBe(false);
    expect(brazoAtrasDelante(-3, 0.35, -1.7)).toBe(false);
    expect(brazoAtrasDelante(0, 2.4, 0)).toBe(false);
  });

  it('el remate pega mas alto y se queda clavado mas que un golpe encadenado', () => {
    for (const name of nombres) {
      const base = ANIMATIONS[name];
      if (base.contacto === undefined) continue;
      const pega = base.brazo ?? 'armFront';
      const seguido = animacion(name, { encadena: true });
      const remate = animacion(name, { encadena: true, remata: true });
      const i = seguido.frames.findIndex((f) => f.t === base.contacto);
      const j = remate.frames.findIndex((f) => f.t === base.contacto);
      expect(remate.frames[j]?.parts[pega]?.rot ?? 0).toBeLessThan(
        seguido.frames[i]?.parts[pega]?.rot ?? 0,
      );
      const sosten = (a: typeof base, k: number) => (a.frames[k + 1]?.t ?? 0) - base.contacto!;
      expect(sosten(remate, j)).toBeGreaterThan(sosten(seguido, i));
      // Sin encadenar no hay remate: es el final de un combo.
      expect(animacion(name, { remata: true })).toBe(base);
    }
  });

  it('las pesadas y largas se cogen a dos manos: el puno de atras cae en el mango', () => {
    const hombros = { delante: { x: 17, y: -25 }, atras: { x: -15, y: -25 } };
    const puno = (h: { x: number; y: number }, b: Pose | undefined, rotAntebrazo: number) => {
      const [cx, cy] = girar(0, LARGO_BRAZO, b?.rot ?? 0);
      const [px, py] = girar(0, ANTEBRAZO_HASTA_PUNO, (b?.rot ?? 0) + rotAntebrazo);
      return [h.x + (b?.x ?? 0) + cx + px, h.y + (b?.y ?? 0) + cy + py] as const;
    };
    for (const name of ['attackPesada', 'attackLarga'] as const) {
      for (const variante of [{}, { encadena: true }, { encadena: true, remata: true }]) {
        const anim = animacion(name, { ...variante, hombros });
        let delante: Frame['parts'] = {};
        let atras: Frame['parts'] = {};
        for (const [k, frame] of anim.frames.entries()) {
          delante = { ...delante, ...frame.parts };
          atras = { ...atras, ...frame.parts };
          if (k === 0 || k === anim.frames.length - 1 || frame.parts.armBack === undefined)
            continue;
          const [fx, fy] = puno(hombros.delante, delante.armFront, delante.forearmFront?.rot ?? 0);
          const [bx, by] = puno(hombros.atras, atras.armBack, atras.forearmBack?.rot ?? 0);
          // Un puno mas alla del otro sobre el mango, ni pegados ni sueltos.
          expect(Math.hypot(bx - fx, by - fy)).toBeGreaterThan(8);
          expect(Math.hypot(bx - fx, by - fy)).toBeLessThan(14);
          expect(
            brazoAtrasDelante(
              atras.armBack?.x ?? 0,
              atras.armBack?.rot ?? 0,
              atras.forearmBack?.rot ?? 0,
            ),
          ).toBe(true);
        }
        // Al volver, cada brazo a su sitio.
        expect(anim.frames.at(-1)?.parts.armBack).toEqual({ rot: 0, x: 0, y: 0 });
      }
    }
    // Sin hombros (la ficha, las hojas viejas) se queda la guardia de siempre.
    expect(animacion('attackPesada')).toBe(ANIMATIONS.attackPesada);
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
      const b = createBrute(n);
      const look = lookFrom(b.appearance, b.slug);
      return JSON.stringify([look.parts.torso, look.parts.head, look.colors]);
    });
    expect(new Set(firmas).size).toBe(nombres.length);
  });

  it('el mismo nombre da siempre el mismo peleon', () => {
    const uno = createBrute('Chirlo de la Cava');
    const a = lookFrom(uno.appearance, uno.slug);
    const b = lookFrom(createBrute('Chirlo de la Cava').appearance, uno.slug);
    expect(a).toEqual(b);
  });

  it('toda apariencia posible resuelve piezas y colores validos', () => {
    for (let i = 0; i < 500; i++) {
      const peleon = createBrute(`peleon numero ${i}`);
      const look = lookFrom(peleon.appearance, peleon.slug);
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

group('cobertura de apariencia', () => {
  it('cada valor de cada campo tiene pieza propia: ni un clon', () => {
    // El objetivo medido de ARTE-Y-TOKENS.md §1.1. Si alguien amplia un rango
    // en el motor sin dibujar la pieza, este test lo caza.
    const rangos = { body: 3, head: 4, hair: 6, skinColor: 5, hairColor: 6, clothColor: 8 };
    const vistos = new Set<string>();

    for (let body = 0; body < rangos.body; body++) {
      for (let head = 0; head < rangos.head; head++) {
        for (let hair = 0; hair < rangos.hair; hair++) {
          const look = lookFrom(
            { body, head, hair, skinColor: 0, hairColor: 0, clothColor: 0 },
            'semilla-fija',
          );
          vistos.add(JSON.stringify([look.parts.torso, look.parts.head]));
        }
      }
    }
    // 3 x 4 x 6 = 72 siluetas distintas. Antes eran 2 x 2 x 4 = 16.
    expect(vistos.size).toBe(rangos.body * rangos.head * rangos.hair);
  });

  it('las paletas cubren exactamente su rango', () => {
    expect(PALETA.piel).toHaveLength(5);
    expect(PALETA.pelo).toHaveLength(6);
    expect(PALETA.ropa).toHaveLength(8);
  });

  it('la faja nunca sale del mismo color que el jubon', () => {
    for (let i = 0; i < 400; i++) {
      const b = createBrute(`faja numero ${i}`);
      const look = lookFrom(b.appearance, b.slug);
      expect(look.colors.ropa2).not.toBe(look.colors.ropa);
    }
  });

  it('un peleon sin clothColor2 guardado sigue teniendo faja', () => {
    // Los creados antes de que el campo existiera: se deriva del slug, no se
    // rellena la base (ARTE-Y-TOKENS.md §1.3).
    const b = createBrute('Chirlo de la Cava');
    const { clothColor2: _sin, ...viejo } = b.appearance;
    expect(lookFrom(viejo, b.slug).colors.ropa2).toBe(lookFrom(b.appearance, b.slug).colors.ropa2);
  });

  it('un peleon sin sexo guardado se pinta igual que hoy', () => {
    const b = createBrute('Chirlo de la Cava');
    const { gender: _g, ...sinSexo } = b.appearance;
    expect(lookFrom(sinSexo, b.slug)).toEqual(lookFrom({ ...sinSexo, gender: 'male' }, b.slug));
  });

  it('la luchadora lleva torso propio y los mismos hombros que el hombre', () => {
    const b = createBrute('Rosca la Brava');
    for (const body of [0, 1, 2]) {
      const h = lookFrom({ ...b.appearance, body, gender: 'male' }, b.slug);
      const m = lookFrom({ ...b.appearance, body, gender: 'female' }, b.slug);
      expect(m.parts.torso).not.toEqual(h.parts.torso);
      expect(m.rig).toEqual(h.rig);
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

group('expresiones', () => {
  const rasgos = { head: 1, hair: 3, beard: 2, brow: 1, mouth: 3, mark: 4 };

  it('cada expresion tiene una cara propia, y la neutral es la de siempre', () => {
    const { debajo, caras, encima } = cabezaPorCapas(rasgos);
    const vistas = new Set(EXPRESIONES.map((e) => JSON.stringify(caras[e])));
    expect(vistas.size).toBe(EXPRESIONES.length);
    for (const e of EXPRESIONES) expect(caras[e].length).toBeGreaterThan(0);

    const peleon = createBrute('Tuerto del Arrabal');
    const look = lookFrom(peleon.appearance, peleon.slug);
    expect(look.parts.head).toEqual([
      ...look.cabeza.debajo,
      ...look.cabeza.caras.neutral,
      ...look.cabeza.encima,
    ]);
    // El parche va encima de la cara: tapa el ojo con cualquier gesto.
    expect(encima.length).toBeGreaterThan(0);
    expect(debajo.length).toBeGreaterThan(0);
  });

  it('parpadear solo cierra los ojos: la boca es la del personaje', () => {
    const { caras } = cabezaPorCapas(rasgos);
    const sinOjos = (shapes: Shape[]) => shapes.slice(-2);
    expect(sinOjos(caras.parpadeo)).toEqual(sinOjos(caras.neutral));
  });

  it('sin las cejas del personaje en los gestos que las contradicen; con las suyas en los demas', () => {
    const { caras } = cabezaPorCapas(rasgos);
    // Las dos primeras formas de la cara tranquila son las cejas (ceja 1).
    const cejas = JSON.stringify(caras.neutral.slice(0, 2));
    const lleva = (shapes: Shape[]) => JSON.stringify(shapes.slice(0, 2)) === cejas;
    for (const e of ['dolor', 'derrotado', 'alegria', 'esfuerzo'] as const) {
      expect(lleva(caras[e])).toBe(false);
    }
    for (const e of ['parpadeo'] as const) expect(lleva(caras[e])).toBe(true);
    // La socarrona conserva la izquierda y enarca la derecha.
    expect(JSON.stringify(caras.socarrona[0])).toBe(JSON.stringify(caras.neutral[0]));
    expect(JSON.stringify(caras.socarrona[1])).not.toBe(JSON.stringify(caras.neutral[1]));
  });
});

group('luchadoras', () => {
  it('los seis peinados de luchadora son distintos entre si y de los del hombre', () => {
    const rasgos = { head: 0, beard: 0, brow: 0, mouth: 0, mark: 0 };
    const m = [0, 1, 2, 3, 4, 5].map((hair) =>
      JSON.stringify(montarCabeza({ ...rasgos, hair, gender: 'female' })),
    );
    const h = [0, 1, 2, 3, 4, 5].map((hair) => JSON.stringify(montarCabeza({ ...rasgos, hair })));
    expect(new Set(m).size).toBe(6);
    m.forEach((c) => expect(h).not.toContain(c));
  });

  it('una luchadora nunca lleva barba', () => {
    const rasgos = { head: 0, hair: 0, brow: 0, mouth: 0, mark: 0, gender: 'female' as const };
    const sin = montarCabeza({ ...rasgos, beard: 0 });
    for (const beard of [1, 2, 3, 4, 5]) expect(montarCabeza({ ...rasgos, beard })).toEqual(sin);
  });

  it('la mellada de la luchadora no es un bloque sobre la barbilla', () => {
    // El bloque relleno de la mellada del hombre se leia como perilla en una cara de mujer.
    const rasgos = { head: 0, hair: 0, beard: 0, brow: 0, mark: 0 };
    const boca = (gender?: 'female') =>
      cabezaPorCapas({ ...rasgos, mouth: 3, gender }).caras.neutral.at(-2)!;
    expect(boca('female')).not.toEqual(boca());
    for (const mouth of [0, 1, 2]) {
      expect(cabezaPorCapas({ ...rasgos, mouth, gender: 'female' }).caras.neutral.at(-1)).toEqual(
        cabezaPorCapas({ ...rasgos, mouth }).caras.neutral.at(-1),
      );
    }
  });

  it('cada peinado de luchadora encaja bajo un sombrero', () => {
    // Con un sombrero (vacio) no se pinta la capa `encima`, sino `bajoSombrero`.
    const rasgos = { head: 0, beard: 0, brow: 0, mouth: 0, mark: 0, gender: 'female' as const };
    for (const hair of [0, 1, 2, 3, 4, 5]) {
      expect(montarCabeza({ ...rasgos, hair }, [])).not.toEqual(montarCabeza({ ...rasgos, hair }));
    }
  });

  it('el monio no asoma bajo un sombrero', () => {
    const rasgos = {
      head: 0,
      hair: 0,
      beard: 0,
      brow: 0,
      mouth: 0,
      mark: 0,
      gender: 'female' as const,
    };
    // `circulo(0, -49, 7.5)`, el monio de la luchadora.
    const monio = 'M -7.5 -49 a 7.5 7.5 0 1 0 15 0 a 7.5 7.5 0 1 0 -15 0 Z';
    const lleva = (shapes: Shape[]) => shapes.some((s) => s.d === monio);
    expect(lleva(montarCabeza(rasgos))).toBe(true);
    expect(lleva(montarCabeza(rasgos, []))).toBe(false);
  });

  const rasgosM = {
    head: 0,
    hair: 0,
    beard: 0,
    brow: 0,
    mouth: 0,
    mark: 0,
    gender: 'female' as const,
  };

  it('la luchadora lleva pestanas en cada gesto salvo dolor y derrotado', () => {
    const h = cabezaPorCapas({ ...rasgosM, gender: undefined });
    const m = cabezaPorCapas(rasgosM);
    for (const e of EXPRESIONES) {
      const extra = m.caras[e].length - h.caras[e].length;
      if (e === 'dolor' || e === 'derrotado') expect(extra).toBe(0);
      else expect(extra).toBeGreaterThan(0);
    }
  });

  it('la ceja de la luchadora va 1,5 mas alta, y las del gesto no se mueven', () => {
    // Sin chirlo, las dos primeras formas de la cara son las cejas del personaje.
    const caras = (r: Rasgos) => cabezaPorCapas(r).caras;
    const m = caras(rasgosM);
    const h = caras({ ...rasgosM, gender: undefined });
    expect(m.neutral[0]?.d).toBe('M -10.5 -30 L -4 -30');
    expect(m.neutral[1]?.d).toBe('M 10.5 -30 L 4 -30');
    expect(m.parpadeo.slice(0, 2)).toEqual(m.neutral.slice(0, 2));
    expect(m.socarrona[0]).toEqual(m.neutral[0]);
    // La V del esfuerzo y la ceja enarcada son del gesto, no del personaje.
    expect(m.esfuerzo.slice(0, 2)).toEqual(h.esfuerzo.slice(0, 2));
    expect(m.socarrona[1]).toEqual(h.socarrona[1]);
  });

  it('con chirlo, la luchadora lleva el claro grande', () => {
    const m = cabezaPorCapas({ ...rasgosM, mark: 3 });
    const h = cabezaPorCapas({ ...rasgosM, mark: 3, gender: undefined });
    expect(m.caras.neutral[0]).not.toEqual(h.caras.neutral[0]);
    expect(m.caras.neutral[0]?.fill).toBe('piel');
    // Sin chirlo no hay claro.
    expect(cabezaPorCapas(rasgosM).caras.neutral[0]?.fill).toBe('oscuro');
  });

  it('lookFrom pasa el sexo a la cabeza', () => {
    const b = createBrute('Rosca la Brava');
    const h = lookFrom({ ...b.appearance, gender: 'male' }, b.slug);
    const m = lookFrom({ ...b.appearance, gender: 'female' }, b.slug);
    expect(m.parts.head).not.toEqual(h.parts.head);
  });
});
