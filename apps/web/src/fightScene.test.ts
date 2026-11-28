import { describe as group, expect, it } from 'vitest';
import { createBrute, growTo, mulberry32, simulate, type FightEvent } from '@camorra/engine';
import {
  PARPADEO,
  pistaDeCaras,
  planFight,
  SEGUNDOS_POR_ACCION,
  type Move,
  type Pie,
} from './fightScene.js';

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

  it('todo el que se planta junto al rival vuelve a casa antes del turno siguiente', () => {
    // Quien contraatacaba se quedaba donde acabo, y el siguiente que iba a por
    // el apuntaba a su casa vacia: lo cruzaba y pegaba al aire de espaldas.
    let contras = 0;
    for (let seed = 0; seed < 300; seed++) {
      const fuera = new Set<string>();
      for (const beat of planFight(fight(seed)).beats) {
        for (const move of beat.moves) {
          if (move.kind === 'pulse') expect([...fuera], `semilla ${seed}`).toEqual([]);
          if (move.kind === 'lunge' || move.kind === 'approach') {
            if (fuera.size > 0 && !fuera.has(move.id)) contras++;
            fuera.add(move.id);
          }
          if (move.kind === 'retreat') fuera.delete(move.id);
          // Un caido se queda donde cae: no tiene que volver.
          if (move.kind === 'fall') fuera.delete(move.id);
        }
      }
    }
    expect(contras).toBeGreaterThan(0);
  });

  it('el contraataque se anima una vez: sin golpe al aire antes del que pega', () => {
    // El motor manda `counter`, luego `move` y `attack`. Si el `counter` tambien
    // embestia, quien contraatacaba pegaba dos veces y solo la segunda llegaba.
    let contras = 0;
    for (let seed = 0; seed < 300; seed++) {
      const scene = planFight(fight(seed));
      for (const [i, beat] of scene.beats.entries()) {
        const contra = beat.moves.find((m) => m.kind === 'float' && m.text === '¡Contra!');
        if (contra === undefined) continue;
        contras++;
        expect(beat.moves.some((m) => m.kind === 'lunge' || m.kind === 'pose')).toBe(false);
        // El ataque llega en los beats siguientes, del mismo que contraataca.
        const ataque = scene.beats
          .slice(i + 1, i + 4)
          .flatMap((b) => b.moves)
          .find((m) => m.kind === 'lunge');
        expect(ataque).toMatchObject({ id: contra.kind === 'float' ? contra.id : '' });
      }
    }
    expect(contras).toBeGreaterThan(0);
  });

  it('cada impacto de un combo tiene su golpe, y a punos alternan las manos', () => {
    // El motor manda un `attack` y luego varios `hit`: sin esto, del segundo
    // impacto en adelante el rival acusaba golpes que nadie daba.
    let combos = 0;
    let cruzados = 0;
    for (let seed = 0; seed < 300; seed++) {
      const replay = fight(seed);
      const scene = planFight(replay);
      const poses = scene.beats.flatMap((b) =>
        b.moves.filter((m): m is Extract<Move, { kind: 'pose' }> => m.kind === 'pose'),
      );
      const golpes = poses.filter((m) => m.anim.startsWith('attack'));
      const seguidos = golpes.filter((m) => m.encadena === true);
      combos += seguidos.length;
      for (const m of seguidos) if (m.anim === 'attackCruzado') cruzados++;

      // Tantos golpes como impactos encadenados en el log.
      let esperados = 0;
      let impactos = 0;
      let quien = '';
      for (const e of replay.log) {
        if (e.type === 'attack') {
          impactos = 0;
          quien = e.id;
        } else if (e.type === 'turn') quien = '';
        else if (e.type === 'hit' && e.id === quien && ++impactos > 1) esperados++;
      }
      const ataquesSeguidos = seguidos.length - esperados;
      expect(ataquesSeguidos, `semilla ${seed}`).toBeGreaterThanOrEqual(0);
      // El cruzado no abre nunca: es el "dos" del uno-dos.
      for (const m of golpes) if (m.anim === 'attackCruzado') expect(m.encadena).toBe(true);
    }
    expect(combos).toBeGreaterThan(0);
    expect(cruzados).toBeGreaterThan(0);
  });

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

  it('los 18 tipos de evento tienen animacion', () => {
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

    expect(vistos.size).toBe(18);
    expect(animados.size).toBe(17);
  }, 30_000);

  it('weaponLost deja al peleon a punos, y si se rompe saltan los trozos', () => {
    const escena = (reason: 'rota' | 'agotada', weapon: string) =>
      planFight({
        winner: 'A',
        seed: 1,
        snapshotA: { appearance: createBrute('uno').appearance, slug: 'uno' },
        snapshotB: { appearance: createBrute('otro').appearance, slug: 'otro' },
        log: [
          {
            type: 'spawn',
            id: 'A',
            name: 'A',
            side: 'A',
            isPet: false,
            hp: 10,
            maxHp: 10,
            weapon,
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
          { type: 'weaponLost', id: 'A', weapon, reason },
        ],
      }).beats.flatMap((b) => b.moves);

    const rota = escena('rota', 'banqueta');
    expect(rota).toContainEqual({ kind: 'weapon', id: 'A', weapon: 'punos' });
    expect(rota).toContainEqual({ kind: 'toss', id: 'A', weapon: 'banqueta' });
    const agotada = escena('agotada', 'cuchillos');
    expect(agotada).toContainEqual({ kind: 'weapon', id: 'A', weapon: 'punos' });
    expect(agotada.some((m) => m.kind === 'toss')).toBe(false);
  });

  it('la botija revienta en el rival: sin trozos en la mano de quien la tira', () => {
    const moves = planFight({
      winner: 'A',
      seed: 1,
      snapshotA: { appearance: createBrute('uno').appearance, slug: 'uno' },
      snapshotB: { appearance: createBrute('otro').appearance, slug: 'otro' },
      log: [
        {
          type: 'spawn',
          id: 'A',
          name: 'A',
          side: 'A',
          isPet: false,
          hp: 10,
          maxHp: 10,
          weapon: 'botija',
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
        { type: 'turn', id: 'A' },
        { type: 'throwWeapon', id: 'A', target: 'B', weapon: 'botija' },
        { type: 'attack', id: 'A', target: 'B', weapon: 'botija' },
        { type: 'evade', id: 'B' },
        { type: 'weaponLost', id: 'A', weapon: 'botija', reason: 'rota' },
      ],
    }).beats.flatMap((b) => b.moves);

    expect(moves.filter((m) => m.kind === 'toss')).toEqual([]);
    const crac = moves.find((m) => m.kind === 'float' && m.text === '¡Crac!');
    expect(crac).toMatchObject({ id: 'B' });
  });

  it('quien muere de una contra se queda tendido: no vuelve andando a su sitio', () => {
    const spawn = (id: 'A' | 'B'): FightEvent => ({
      type: 'spawn',
      id,
      name: id,
      side: id,
      isPet: false,
      hp: 10,
      maxHp: 10,
      weapon: 'punos',
    });
    const beats = planFight({
      winner: 'B',
      seed: 1,
      snapshotA: { appearance: createBrute('uno').appearance, slug: 'uno' },
      snapshotB: { appearance: createBrute('otro').appearance, slug: 'otro' },
      log: [
        spawn('A'),
        spawn('B'),
        { type: 'turn', id: 'A' },
        { type: 'move', id: 'A', target: 'B' },
        { type: 'attack', id: 'A', target: 'B', weapon: 'punos' },
        { type: 'evade', id: 'B' },
        { type: 'counter', id: 'B', target: 'A' },
        { type: 'move', id: 'B', target: 'A' },
        { type: 'attack', id: 'B', target: 'A', weapon: 'punos' },
        { type: 'hit', id: 'B', target: 'A' },
        { type: 'damage', id: 'A', amount: 10, hp: 0 },
        { type: 'death', id: 'A' },
        { type: 'end', winner: 'B', turns: 1 },
      ],
    }).beats;

    const moves = beats.flatMap((b) => b.moves);
    const caida = moves.findIndex((m) => m.kind === 'fall' && m.id === 'A');
    expect(caida).toBeGreaterThan(-1);
    const despues = moves.slice(caida + 1).filter((m) => 'id' in m && m.id === 'A');
    expect(despues.filter((m) => m.kind === 'retreat' || m.kind === 'pose')).toEqual([]);
    // Quien contraataco si vuelve a su sitio.
    expect(moves.slice(caida + 1)).toContainEqual({ kind: 'retreat', id: 'B' });
  });

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

group('pistaDeCaras', () => {
  it('ordenada, solo para peleones, y acaba en KO para el que cae y en risa para el que gana', () => {
    for (let seed = 0; seed < 200; seed++) {
      const scene = planFight(fight(seed));
      const pistas = pistaDeCaras(scene);
      const peleones = scene.actors.filter((a) => a.appearance !== null);
      expect([...pistas.keys()].sort()).toEqual(peleones.map((a) => a.id).sort());

      for (const [id, cambios] of pistas) {
        for (let i = 1; i < cambios.length; i++) {
          expect(cambios[i]?.at ?? 0).toBeGreaterThanOrEqual(cambios[i - 1]?.at ?? 0);
        }
        const final = cambios.at(-1)?.cara;
        const muere = scene.beats.some((b) =>
          b.moves.some((m) => m.kind === 'face' && m.id === id && m.cara === 'derrotado'),
        );
        expect(final).toBe(muere ? 'derrotado' : 'alegria');
      }
    }
  });

  it('parpadea en los ratos tranquilos, cada pocos segundos y nunca encima de un gesto', () => {
    const scene = planFight(fight(7));
    for (const cambios of pistaDeCaras(scene).values()) {
      const parpadeos = cambios.filter((c) => c.cara === 'parpadeo');
      expect(parpadeos.length).toBeGreaterThan(0);
      for (const p of parpadeos) {
        const i = cambios.indexOf(p);
        // Lo que viene justo despues de cerrar los ojos es abrirlos, a su hora.
        expect(cambios[i + 1]).toEqual({ at: p.at + PARPADEO, cara: 'neutral' });
        // Se cierran desde la cara tranquila o al soltar un gesto, nunca a otro parpadeo.
        expect(cambios[i - 1]?.cara).not.toBe('parpadeo');
      }
      for (let i = 1; i < parpadeos.length; i++) {
        expect((parpadeos[i]?.at ?? 0) - (parpadeos[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('el parpadeo deja aire antes de un gesto: nada de cerrar, abrir y > < seguidos', () => {
    for (let seed = 0; seed < 60; seed++) {
      for (const cambios of pistaDeCaras(planFight(fight(seed))).values()) {
        for (const [i, c] of cambios.entries()) {
          if (c.cara !== 'parpadeo') continue;
          const gesto = cambios
            .slice(i + 2)
            .find((d) => d.cara !== 'neutral' && d.cara !== 'parpadeo');
          if (gesto !== undefined)
            expect(gesto.at - (c.at + PARPADEO)).toBeGreaterThanOrEqual(0.35 - 1e-9);
        }
      }
    }
  });

  it('la esquiva se lleva media sonrisa, y el ganador rie en el mismo instante en que cae el otro', () => {
    for (let seed = 0; seed < 100; seed++) {
      const scene = planFight(fight(seed));
      const caras = scene.beats.flatMap((b) =>
        b.moves.flatMap((m) => (m.kind === 'face' ? [{ at: b.at, m }] : [])),
      );
      const esquivas = scene.beats.filter((b) =>
        b.moves.some((m) => m.kind === 'pose' && m.anim === 'evade'),
      );
      for (const b of esquivas) {
        expect(b.moves.some((m) => m.kind === 'face' && m.cara === 'socarrona')).toBe(true);
      }
      // La ultima caida es la que decide; antes pueden caer mascotas.
      const ko = [...caras].reverse().find((c) => c.m.cara === 'derrotado');
      const risa = caras.find((c) => c.m.cara === 'alegria');
      if (ko !== undefined && risa !== undefined) expect(risa.at).toBe(ko.at);
    }
  });

  it('a x4 los gestos y los parpadeos duran lo mismo en tiempo real', () => {
    const scene = planFight(fight(7));
    for (const cambios of pistaDeCaras(scene, { parpadeo: true, escala: 4 }).values()) {
      const p = cambios.find((c) => c.cara === 'parpadeo');
      if (p === undefined) continue;
      const i = cambios.indexOf(p);
      expect((cambios[i + 1]?.at ?? 0) - p.at).toBeCloseTo(PARPADEO * 4, 9);
    }
  });

  it('entre dos gestos nunca asoma un destello de cara tranquila de menos de 0,3 s reales', () => {
    for (const escala of [1, 2, 4]) {
      for (let seed = 0; seed < 40; seed++) {
        for (const cambios of pistaDeCaras(planFight(fight(seed)), {
          parpadeo: true,
          escala,
        }).values()) {
          for (let i = 1; i < cambios.length - 1; i++) {
            const c = cambios[i];
            const antes = cambios[i - 1];
            const despues = cambios[i + 1];
            if (c?.cara !== 'neutral' || antes === undefined || despues === undefined) continue;
            if (antes.cara === 'parpadeo' || despues.cara === 'parpadeo') continue;
            expect(despues.at - c.at).toBeGreaterThanOrEqual(0.3 * escala - 1e-9);
          }
        }
      }
    }
  });

  it('a x2 los ojos siguen cerrandose de vez en cuando', () => {
    const scene = planFight(fight(7));
    for (const cambios of pistaDeCaras(scene, { parpadeo: true, escala: 2 }).values()) {
      expect(cambios.filter((c) => c.cara === 'parpadeo').length).toBeGreaterThan(1);
    }
  });

  it('con menos movimiento no parpadea, pero los gestos se quedan', () => {
    const scene = planFight(fight(7));
    for (const cambios of pistaDeCaras(scene, { parpadeo: false }).values()) {
      expect(cambios.some((c) => c.cara === 'parpadeo')).toBe(false);
      expect(cambios.some((c) => c.cara !== 'neutral')).toBe(true);
    }
  });

  it('el mismo combate parpadea siempre igual', () => {
    const scene = planFight(fight(11));
    expect([...pistaDeCaras(scene)]).toEqual([...pistaDeCaras(planFight(fight(11)))]);
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
    case 'weaponLost':
      return { type, id: 'A', weapon: 'banqueta', reason: 'rota' };
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
