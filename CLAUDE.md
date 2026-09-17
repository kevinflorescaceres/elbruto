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

## Base de datos

Hay dos caminos y ambos valen:

- **Docker** (`pnpm db:up`): `docker-compose.yml` levanta PostgreSQL 16 y crea
  `rufianes` y `rufianes_test`. Es lo que usa CI.
- **PostgreSQL nativo**: esta maquina de desarrollo lo tiene instalado y es lo que
  se ha usado. `sudo service postgresql start` y listo. **La instancia es compartida
  con otros proyectos** (`hattrick_db`): no tocar nada fuera de `rufianes*`.

Los tests de integracion corren contra `rufianes_test` y truncan las tablas entre
tests, asi que nunca pisan la base de desarrollo.

## Convenciones

- Paquetes del workspace: `@rufianes/engine`, `@rufianes/shared`, `@rufianes/server`,
  `@rufianes/web`.
- Los paquetes exportan **TypeScript fuente** (`exports: "./src/index.ts"`), sin paso de
  build intermedio. Vite y tsx los consumen directamente.
- Un solo `eslint.config.js` en la raíz, y un `vitest.config.ts` raíz. La única
  excepción es `apps/server/vitest.config.ts`: los tests de integración necesitan
  apuntar a otra base de datos y no pueden correr en paralelo sobre ella.
- Tests junto al código: `src/loquesea.test.ts`.
- `packages/engine`: cero dependencias, sin `Math.random`, sin `Date`, sin imports no
  relativos. **ESLint lo bloquea** (regla en `eslint.config.js`), no es solo una convención.
  Los tests del motor sí pueden importar `vitest`.
- Todo lo que cruza la red se valida con esquemas Zod de `packages/shared`, en los dos lados.
- **El servidor no contiene reglas de juego.** Todo lo que decide algo (`simulate`,
  `addXp`, `rollLevelUpOptions`, `applyLevelUpOption`, `createBrute`, `slugify`) vive
  en el motor. Si te ves escribiendo una fórmula en `apps/server`, está en el sitio malo.
- Prisma 7 no admite `url` en el schema: la conexión va en `apps/server/prisma.config.ts`
  y el cliente usa el driver adapter de `pg`. `prisma` está fijado en 7.10.0 porque su
  tag `latest` en npm apunta a una release candidate de la 8.
- `ENGINE_VERSION` sube cada vez que cambian las reglas del combate.

## Ajustes de reglas

`plan.md` §6 y §7 llevan marcadas con _(Ajustado en Fase 1)_ las reglas que cambiaron
al medir el balance. Si vuelves a tocar los números del catálogo, corre `pnpm balance`:
es la única forma de saber si un cambio rompe algo.

## Estado

Fases 0, 1 y 2 completas. Siguiente: Fase 3 (frontend funcional).
