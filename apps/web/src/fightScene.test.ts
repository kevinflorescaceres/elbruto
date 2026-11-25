import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo, mulberry32, simulate, type FightEvent } from '@camorra/engine';
import { planFight, SEGUNDOS_POR_ACCION, type Move, type Pie } from './fightScene.js';

/** Combates variados: con mascotas, de todos los niveles. */
function fight(seed: number) {
  const rng = mulberry32(seed);
  const level = (seed % 30) + 1;
  const base = growTo(createBrute(`escena-${seed}-a`), level, rng);
  const a = seed % 3 === 0 ? { ...base, pets: ['chucho', 'mastin'] } : base;
  const b = growTo(createBrute(`escena-${seed}-b`), level, rng);
  return {
    ...simulate(a, b, seed * 17 + 3),
    snapshotA: { appearance: a.appearance, slug: a.slug },
    snapshotB: { appearance: b.appearance, slug: b.slug },
  };
}

/** Todo id de combatiente al que apunta un movimiento. */
function referenced(move: Move): string[] {
  if (move.kind === 'announce') return [];
  if (move.kind === 'projectile') return [move.from, move.to];
  if (move.kind === 'approach' || move.kind === 'lunge') return [move.id, move.toward];
  return [move.id];
}

group('planFight', () => {
  it('reproduce cualquier combate de principio a fin sin incoherencias', () => {
    for (let seed = 0; seed < 600; seed++) {
      const scene = planFight(fight(seed));
      const ids = new Set(scene.actors.map((a) => a.id));

      expect(scene.actors.length).toBeGreaterThanOrEqual(2);
      expect(scene.duration).toBeGreaterThan(0);
      expect(Number.isFinite(scene.duration)).toBe(true);

      let previous = -1;
      for (const beat of scene.beats) {
        // Los tiempos avanzan y nunca retroceden.
        expect(beat.at).toBeGreaterThanOrEqual(previous);
        previous = beat.at;
        expect(Number.isFinite(beat.at)).toBe(true);
        expect(beat.duration).toBeGreaterThanOrEqual(0);

        for (const move of beat.moves) {
          for (const id of referenced(move)) {
            if (!ids.has(id)) throw new Error(`semilla ${seed}: ${move.kind} apunta a ${id}`);
          }
        }
      }

      const last = scene.beats.at(-1);
      expect(scene.duration).toBeCloseTo((last?.at ?? 0) + (last?.duration ?? 0), 6);
    }
  }, 30_000);

  it('el ataque que acaba parado usa su version parada, y el que entra no', () => {
    let paradas = 0;
    for (let seed = 0; seed < 200; seed++) {
      let ataque: Extract<Move, { kind: 'pose' }> | undefined;
      for (const beat of planFight(fight(seed)).beats) {
        for (const move of beat.moves) {
          if (move.kind !== 'pose') continue;
          if (move.anim.startsWith('attack')) ataque = move;
          if (move.anim === 'block' && ataque !== undefined) {
            expect(ataque.parada).toBe(true);
            paradas++;
          }
          if (move.anim === 'evade' && ataque !== undefined) expect(ataque.parada).toBeFalsy();
        }
      }
    }
    expect(paradas).toBeGreaterThan(0);
  });

  it('todas las posiciones caen dentro del lienzo', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const actor of planFight(fight(seed)).actors) {
        expect(actor.home.x).toBeGreaterThan(0);
        expect(actor.home.x).toBeLessThan(1);
        expect(actor.home.y).toBeGreaterThan(0);
        expect(actor.home.y).toBeLessThan(1);
        expect(actor.maxHp).toBeGreaterThan(0);
      }
    }
  });

  it('los 17 tipos de evento tienen animacion', () => {
    const vistos = new Set<FightEvent['type']>();
    const animados = new Set<FightEvent['type']>();

    for (let seed = 0; seed < 600; seed++) {
      const result = fight(seed);
      for (const event of result.log as FightEvent[]) vistos.add(event.type);

      const scene = planFight(result);
      // `start` no pinta nada y es correcto: no genera beat.
      const conMoves = scene.beats.filter((b) => b.moves.length > 0).length;
      expect(conMoves).toBe(scene.beats.length);
    }

    // Cada tipo que aparece en algun combate debe producir movimiento.
    for (const type of vistos) {
      if (type === 'start') continue;
      const scene = planFight({
        winner: 'A',
        seed: 1234,
        snapshotA: { appearance: createBrute('uno de prueba').appearance, slug: 'uno-de-prueba' },
        snapshotB: { appearance: createBrute('otro de prueba').appearance, slug: 'otro-de-prueba' },
        log: [
          {
            type: 'spawn',
            id: 'A',
            name: 'A',
            side: 'A',
            isPet: false,
            hp: 10,
            maxHp: 10,
            weapon: 'punos',
          },
          {
            type: 'spawn',
            id: 'B',
            name: 'B',
            side: 'B',
            isPet: false,
            hp: 10,
            maxHp: 10,
            weapon: 'punos',
          },
          muestra(type),
        ],
      });
      const ultimo = scene.beats.at(-1);
      if ((ultimo?.moves.length ?? 0) === 0) throw new Error(`${type} no anima nada`);
      animados.add(type);
    }

    expect(vistos.size).toBe(17);
    expect(animados.size).toBe(16);
  }, 30_000);

  it('cada accion de un peleon dura lo mismo', () => {
    // El ritmo es lo que hace que un combate se siga con la vista. Antes cada
    // evento traia su duracion y un turno podia durar 0,32 s o 2,0 s.
    for (let seed = 0; seed < 120; seed++) {
      const scene = planFight(fight(seed));

      // Un turno empieza con su latido; el hueco hasta el siguiente es su duracion.
      const inicios = scene.beats
        .filter((b) => b.moves.some((m) => m.kind === 'pulse'))
        .map((b) => b.at);

      for (let i = 1; i < inicios.length; i++) {
        const dura = (inicios[i] ?? 0) - (inicios[i - 1] ?? 0);
        // Una accion, o dos si en ese turno hubo contraataque.
        const valido =
          Math.abs(dura - SEGUNDOS_POR_ACCION) < 1e-6 ||
          Math.abs(dura - SEGUNDOS_POR_ACCION * 2) < 1e-6;
        if (!valido) throw new Error(`semilla ${seed}: una accion duro ${dura.toFixed(3)} s`);
      }
    }
  });

  it('el pie de escena usa nombres y no ids', () => {
    const scene = planFight(fight(3));
    const textos = scene.beats.flatMap((b) =>
      b.pie === null ? [] : [...b.pie.linea, ...b.pie.narracion],
    );

    expect(textos.length).toBeGreaterThan(0);
    for (const texto of textos) {
      expect(texto).not.toMatch(/\b[AB]-pet-\d\b/);
    }
  });

  it('la linea del pie solo crece dentro de una accion: nada se borra antes de tiempo', () => {
    for (let seed = 0; seed < 300; seed++) {
      let previo: Pie | null = null;
      for (const beat of planFight(fight(seed)).beats) {
        const pie = beat.pie;
        if (pie === null) continue;
        if (previo !== null && previo.accion === pie.accion) {
          expect(pie.linea.slice(0, previo.linea.length)).toEqual(previo.linea);
          expect(pie.narracion.slice(0, previo.narracion.length)).toEqual(previo.narracion);
        }
        previo = pie;
      }
    }
  });

  it('la linea no repite lo que el lienzo ya ensena; la narracion lo cuenta todo', () => {
    for (let seed = 0; seed < 100; seed++) {
      const pies = planFight(fight(seed)).beats.flatMap((b) => (b.pie === null ? [] : [b.pie]));
      const linea = pies.flatMap((p) => p.linea);
      const narracion = pies.flatMap((p) => p.narracion);

      // Dano, esquivas y paradas ya se ven: numero flotante, pose y chispa.
      for (const frase of linea) expect(frase).not.toMatch(/encaja|se aparta|para el golpe/);
      expect(narracion.some((f) => f.includes('encaja'))).toBe(true);
    }
  });

  it('la linea no nombra al rival, que se ve en el lienzo; la narracion si', () => {
    // Los peleones de `fight` se llaman escena-<semilla>-a y escena-<semilla>-b.
    const alRival = / a escena-\d+-[ab]\b/;
    for (let seed = 0; seed < 100; seed++) {
      const pies = planFight(fight(seed)).beats.flatMap((b) => (b.pie === null ? [] : [b.pie]));
      for (const frase of pies.flatMap((p) => p.linea)) expect(frase).not.toMatch(alRival);
      expect(pies.flatMap((p) => p.narracion).some((f) => alRival.test(f))).toBe(true);
    }
  });

  it('el final no tapa la ultima accion: la linea se queda y la narracion lo suma', () => {
    for (let seed = 0; seed < 300; seed++) {
      const pies = planFight(fight(seed)).beats.flatMap((b) => (b.pie === null ? [] : [b.pie]));
      const ultimo = pies.at(-1);
      // El ultimo pie de la ultima accion de verdad, antes del cierre.
      const accion = pies.filter((p) => !p.narracion.at(-1)?.startsWith('Se acabó')).at(-1);

      expect(ultimo?.narracion.at(-1)).toMatch(/^Se acabó en \d+ turnos\.$/);
      expect(ultimo?.linea).toEqual(accion?.linea);
      expect(ultimo?.linea.join(' ')).not.toMatch(/Se acabó/);
      // Misma accion: el lector de pantalla oye "Se acabó" como una frase mas.
      expect(ultimo?.accion).toBe(accion?.accion);
    }
  });

  it('la esquiva y la parada se ven sobre quien las hace, como el dano', () => {
    const letreros = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      for (const beat of planFight(fight(seed)).beats) {
        for (const m of beat.moves) if (m.kind === 'float') letreros.add(m.text);
      }
    }
    expect(letreros).toContain('¡Esquiva!');
    expect(letreros).toContain('¡Parada!');
  });

  it('la linea visible dura lo que una accion, no lo que un evento', () => {
    const duraciones: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      let texto: string | null = null;
      let desde = 0;
      for (const beat of planFight(fight(seed)).beats) {
        if (beat.pie === null) continue;
        const nuevo = beat.pie.linea.join(' ');
        if (nuevo === texto) continue;
        // Lo que crece no se pierde de vista: solo cuenta lo que se reemplaza.
        const crece = texto !== null && nuevo.startsWith(texto);
        if (texto !== null && !crece) duraciones.push(beat.at - desde);
        if (!crece) desde = beat.at;
        texto = nuevo;
      }
    }
    duraciones.sort((x, y) => x - y);
    // Antes la mediana era 0,36 s: un golpe con su dano y el siguiente en la misma accion.
    expect(duraciones[Math.floor(duraciones.length / 2)]).toBeGreaterThanOrEqual(
      SEGUNDOS_POR_ACCION * 0.9,
    );
  });
});

/** Un evento minimo de cada tipo, para comprobar que ninguno se queda sin animar. */
function muestra(type: FightEvent['type']): FightEvent {
  switch (type) {
    case 'spawn':
      return { type, id: 'C', name: 'C', side: 'A', isPet: true, hp: 5, maxHp: 5, weapon: 'punos' };
    case 'turn':
      return { type, id: 'A' };
    case 'move':
    case 'attack':
      return type === 'move'
        ? { type, id: 'A', target: 'B' }
        : { type, id: 'A', target: 'B', weapon: 'punos' };
    case 'hit':
      return { type, id: 'A', target: 'B' };
    case 'evade':
    case 'block':
      return { type, id: 'B' };
    case 'counter':
      return { type, id: 'B', target: 'A' };
    case 'damage':
      return { type, id: 'B', amount: 3, hp: 7 };
    case 'heal':
      return { type, id: 'A', amount: 3, hp: 10 };
    case 'drawWeapon':
      return { type, id: 'A', weapon: 'chaira' };
    case 'throwWeapon':
      return { type, id: 'A', target: 'B', weapon: 'cascote' };
    case 'disarm':
      return { type, id: 'A', target: 'B', weapon: 'chaira' };
    case 'skill':
      return { type, id: 'A', skill: 'revire' };
    case 'death':
      return { type, id: 'B' };
    case 'end':
      return { type, winner: 'A', turns: 4 };
    default:
      throw new Error(`sin muestra para ${type}`);
  }
}
