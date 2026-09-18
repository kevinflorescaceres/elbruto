/**
 * Bots de relleno para los niveles 1 a 30 (PLAN.md §6). Sin ellos, un luchador
 * nuevo no encuentra a nadie de su nivel contra quien pelear.
 *
 * Idempotente: los slugs son fijos, se vuelve a correr sin duplicar nada.
 */
import { createBrute, growTo, mulberry32 } from '@camorra/engine';
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
  const rng = mulberry32(0xb0705);
  let created = 0;

  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (let i = 0; i < PER_LEVEL; i++) {
      const name = `${NOMBRES[i % NOMBRES.length]} ${APODOS[(i + level) % APODOS.length]} ${level}`;
      const base = createBrute(name);
      const brute = growTo(base, level, rng);

      const existing = await prisma.brute.findUnique({ where: { slug: brute.slug } });
      if (existing !== null) continue;

      await prisma.brute.create({
        data: {
          name: brute.name,
          slug: brute.slug,
          isBot: true,
          level: brute.level,
          xp: brute.xp,
          endurance: brute.endurance,
          strength: brute.strength,
          agility: brute.agility,
          speed: brute.speed,
          weapons: brute.weapons,
          skills: brute.skills,
          pets: brute.pets,
          appearance: asJson(brute.appearance),
        },
      });
      created += 1;
    }
  }

  console.log(`bots creados: ${created} (${PER_LEVEL} por nivel, niveles 1-${MAX_LEVEL})`);
}

await main();
await prisma.$disconnect();
