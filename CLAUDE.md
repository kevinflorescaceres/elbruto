# CLAUDE.md — Rufianes

El plan completo está en `plan.md`. Se trabaja **una fase a la vez** (sección 10) y no se
avanza sin cumplir el criterio de "Listo cuando". La sección 11 (contenido original) no es
negociable.

## Comandos

| Comando                  | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `pnpm dev`               | Levanta server (:3000) y web (:5173) en paralelo |
| `pnpm test`              | Vitest sobre `packages/*` y `apps/server`        |
| `pnpm typecheck`         | `tsc --noEmit` en cada paquete                   |
| `pnpm lint`              | ESLint en todo el repo                           |
| `pnpm format`            | Prettier --write                                 |
| `pnpm db:up` / `db:down` | PostgreSQL 16 en Docker                          |

`pnpm` se activa con `corepack enable pnpm` (Node 22 lo trae; no hay instalación global).

## Convenciones

- Paquetes del workspace: `@rufianes/engine`, `@rufianes/shared`, `@rufianes/server`,
  `@rufianes/web`.
- Los paquetes exportan **TypeScript fuente** (`exports: "./src/index.ts"`), sin paso de
  build intermedio. Vite y tsx los consumen directamente.
- Un solo `vitest.config.ts` y un solo `eslint.config.js`, en la raíz. No añadir configs
  por paquete.
- Tests junto al código: `src/loquesea.test.ts`.
- `packages/engine`: cero dependencias, sin `Math.random`, sin `Date`, sin imports no
  relativos. **ESLint lo bloquea** (regla en `eslint.config.js`), no es solo una convención.
  Los tests del motor sí pueden importar `vitest`.
- Todo lo que cruza la red se valida con esquemas Zod de `packages/shared`, en los dos lados.
- `ENGINE_VERSION` sube cada vez que cambian las reglas del combate.

## Ajustes de reglas

`plan.md` §6 y §7 llevan marcadas con _(Ajustado en Fase 1)_ las reglas que cambiaron
al medir el balance. Si vuelves a tocar los números del catálogo, corre `pnpm balance`:
es la única forma de saber si un cambio rompe algo.

## Estado

Fases 0 y 1 completas. Siguiente: Fase 2 (backend).
