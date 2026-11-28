/**
 * Imprime la ultima novedad en Markdown, para el release de GitHub:
 * pnpm --filter @camorra/web --silent novedades | gh release create v2026.11.28 --notes-file -
 */
import { NOVEDADES, aMarkdown } from './novedades.js';

const ultima = NOVEDADES[0];
if (ultima === undefined) throw new Error('No hay novedades');
process.stdout.write(aMarkdown(ultima));
