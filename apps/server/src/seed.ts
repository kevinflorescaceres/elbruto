/**
 * Bots de relleno para los niveles 1 a 30 (PLAN.md §6). Sin ellos, un luchador
 * nuevo no encuentra a nadie de su nivel contra quien pelear.
 *
 * Idempotente y ADEMAS correctivo: si cambian las reglas del motor, volver a
 * correrlo pone a los bots existentes al dia en vez de saltarselos. Sin eso, los
 * oponentes se quedan congelados en las reglas del dia que se sembraron, y el
 * juego se descalibra sin que se note.
 *
 * Cada bot se genera con su propia semilla derivada del slug, asi que el
 * resultado no depende del orden del bucle.
 */
import { createBrute, growTo, hashString, mulberry32 } from '@camorra/engine';
import { asJson, prisma } from './db.js';

const PER_LEVEL = 8;
const MAX_LEVEL = 30;

/** Nombres de taberna, mismo tono que el catalogo. Todos originales. */
const NOMBRES = ['Tuerto', 'Zurdo', 'Manco', 'Chirlo', 'Bizco', 'Rengo', 'Mellado', 'Pelon'];
const APODOS = [
  'del Arrabal',
  'de la Cava',
  'el Rufo',
  'de Poniente',
  'el Jaque',
  'de Santa Cruz',
  'el Gallo',
  'de la Sierpe',
];

async function main(): Promise<void> {
  let creados = 0;
  let actualizados = 0;

  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (let i = 0; i < PER_LEVEL; i++) {
      const name = `${NOMBRES[i % NOMBRES.length]} ${APODOS[(i + level) % APODOS.length]} ${level}`;
      const base = createBrute(name);
      const brute = growTo(base, level, mulberry32(hashString(`bot:${base.slug}`)));

      // El nombre, el slug y la apariencia no cambian nunca: son del nombre.
      // Lo que se recalcula es todo lo que depende de las reglas del motor.
      const reglas = {
        level: brute.level,
        xp: brute.xp,
        endurance: brute.endurance,
        strength: brute.strength,
        agility: brute.agility,
        speed: brute.speed,
        weapons: brute.weapons,
        skills: brute.skills,
        pets: brute.pets,
      };

      const existente = await prisma.brute.findUnique({ where: { slug: brute.slug } });
      if (existente === null) {
        await prisma.brute.create({
          data: {
            ...reglas,
            name: brute.name,
            slug: brute.slug,
            isBot: true,
            appearance: asJson(brute.appearance),
          },
        });
        creados += 1;
      } else if (existente.isBot) {
        await prisma.brute.update({ where: { slug: brute.slug }, data: reglas });
        actualizados += 1;
      }
    }
  }

  console.log(
    `bots: ${creados} creados, ${actualizados} puestos al dia ` +
      `(${PER_LEVEL} por nivel, niveles 1-${MAX_LEVEL})`,
  );
}

await main();
await prisma.$disconnect();
