/**
 * Comandos de retirada (PLAN.md §11): renombrar o borrar un luchador a peticion.
 *
 *   pnpm admin list-reports
 *   pnpm admin list-feedback
 *   pnpm admin rename <slug> <nombre nuevo>
 *   pnpm admin delete <slug>
 */
import { createBrute } from '@camorra/engine';
import { appearanceSchema } from '@camorra/shared';
import { asJson, prisma } from './db.js';
import { checkName } from './names.js';

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case 'list-reports': {
      const reports = await prisma.report.findMany({
        include: { brute: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      for (const r of reports) {
        console.log(`${r.createdAt.toISOString()}  ${r.brute.slug.padEnd(24)} ${r.reason}`);
      }
      console.log(`${reports.length} denuncias`);
      break;
    }

    case 'list-feedback': {
      const reportes = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
      for (const r of reportes) {
        const contacto = r.contact === null ? '' : `  (${r.contact})`;
        console.log(`${r.createdAt.toISOString()}  ${r.page}  ${r.viewport ?? ''}${contacto}`);
        console.log(`  ${r.message.replaceAll('\n', '\n  ')}\n`);
      }
      console.log(`${reportes.length} reportes`);
      break;
    }

    case 'rename': {
      const [slug, ...rest] = args;
      const nuevo = rest.join(' ');
      if (slug === undefined || nuevo.length === 0) throw new Error('uso: rename <slug> <nombre>');

      const check = checkName(nuevo);
      if (!check.ok) throw new Error(check.reason);

      // El nombre define la apariencia; se regenera para que sigan cuadrando,
      // conservando el sexo (las filas antiguas no lo traen: eran hombres).
      const actual = await prisma.brute.findUniqueOrThrow({ where: { slug } });
      const gender = appearanceSchema.parse(actual.appearance).gender ?? 'male';
      const regenerado = createBrute(nuevo, gender);
      const updated = await prisma.brute.update({
        where: { slug },
        data: {
          name: regenerado.name,
          slug: regenerado.slug,
          appearance: asJson(regenerado.appearance),
        },
      });
      console.log(`renombrado: ${slug} -> ${updated.slug}`);
      break;
    }

    case 'delete': {
      const [slug] = args;
      if (slug === undefined) throw new Error('uso: delete <slug>');
      await prisma.brute.delete({ where: { slug } });
      console.log(`borrado: ${slug}`);
      break;
    }

    default:
      console.log(
        'comandos: list-reports | list-feedback | rename <slug> <nombre> | delete <slug>',
      );
      process.exitCode = 1;
  }
}

await main();
await prisma.$disconnect();
