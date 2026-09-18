# CLAUDE.md — Camorra

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

## Base de datos (local)

El `.env` de la raiz (ignorado por git) manda sobre los valores por defecto, y la shell
manda sobre el `.env`. Lo leen los scripts del servidor, vitest, playwright y Prisma.

**En esta maquina el rol de Postgres se llama `rufianes`** por herencia del nombre
provisional del proyecto, y no tengo permisos para crear roles. Para dejarlo parejo:
`sudo -u postgres psql -c "CREATE ROLE camorra LOGIN PASSWORD 'camorra' CREATEDB"` y luego
borrar el `.env`. Mientras tanto, funciona igual.

Hay dos caminos y ambos valen:

- **Docker** (`pnpm db:up`): `docker-compose.yml` levanta PostgreSQL 16 y crea
  `camorra` y `camorra_test`. Es lo que usa CI.
- **PostgreSQL nativo**: esta maquina de desarrollo lo tiene instalado y es lo que
  se ha usado. `sudo service postgresql start` y listo. **La instancia es compartida
  con otros proyectos** (`hattrick_db`): no tocar nada fuera de `camorra*`.

Los tests de integracion corren contra `camorra_test` y truncan las tablas entre
tests, asi que nunca pisan la base de desarrollo.

## Frontend

- `src/api.ts` es el unico sitio que habla con el servidor, y **valida cada respuesta**
  con los esquemas de `shared`. No hacer `fetch` suelto desde un componente.
- Los nombres de armas, mañas y bichos salen de `@camorra/engine` (`getWeapon`,
  `getSkill`, `getPet`). No duplicar tablas de nombres en la web.
- `src/fightLines.ts` es puro y no depende de React: convierte el log en lineas de
  texto. La Fase 4 reutiliza ese mismo recorrido para la linea de tiempo de PixiJS.
- Estilos: un `styles.css` y ya. Sin framework de CSS.

## Arte (Fase 5)

- **El arte son datos.** `art/parts.ts` tiene las rutas SVG y las paletas; `art/poses.ts`
  las animaciones como keyframes. Ninguno de los dos sabe de Pixi ni del DOM.
- **Dos renderers, un origen.** `art/Fighter.tsx` pinta `<svg>` para la ficha y la arena;
  `art/pixiRig.ts` monta el mismo personaje como rig de contenedores para el combate.
  Si tocas una ruta, cambia en los dos sitios a la vez.
- **`pnpm --filter @camorra/web art <dir>`** escribe hojas de contacto en SVG
  (variedad, poses, armas, bichos). Es la unica forma de mirar el arte sin navegador:
  usalo antes de dar por buena cualquier ruta nueva. Para verlas como PNG hace falta un
  rasterizador (`@resvg/resvg-js` en un directorio aparte, no es dependencia del repo).
- La apariencia sale de `Appearance`, que se genera en el motor y **se guarda en la BD**:
  cambiar el arte no debe cambiar la cara de un peleon ya creado.

## Convenciones

- Paquetes del workspace: `@camorra/engine`, `@camorra/shared`, `@camorra/server`,
  `@camorra/web`.
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
- `ENGINE_VERSION` sube cada vez que cambian las reglas del combate. Va por **3**.
  Los combates antiguos se siguen viendo: se reproducen desde su log guardado, no se
  vuelven a simular.
- **Los textos que ve el jugador llevan tildes.** Los comentarios del código no, para
  evitar problemas de codificación, pero la interfaz es español correcto.
- `apps/web/public/og.png` se genera con `pnpm --filter @camorra/web art` y se rasteriza
  a mano (ver la seccion de Arte). Se versiona: no se construye en cada despliegue.

## El combate

`combate.md` manda sobre la sección 6 de `plan.md` donde haya conflicto. Lo implementado:

- **Vida** `floor(50 + resistencia*6 + nivel*1.5)`. El término por nivel sube la vida en
  paralelo al daño, para que el combate no se acorte al subir.
- **Intervalo** `round(intervalo*100 / (10 + velocidad))`, con un ±18% de azar. Sin ese
  azar, dos peleones iguales alternan en lockstep y nunca encadenan dos acciones.
- **Combos**: hasta 3 impactos, cada uno al 70% del **anterior** (no de la base), con
  probabilidad `comboRate + agilidad*2`, tope 45%.
- **Defensa** en orden: esquiva → bloqueo → contraataque. El contraataque responde a la
  **esquiva**, y un arma larga en la mano añade 25 puntos.
- **Arrojadizas**: solo se lanzan, no se agotan, y el daño escala con agilidad.
- **Mascotas**: cuestan resistencia (2/4/8), así que tener bicho te hace más frágil.

**Dos desviaciones del documento, medidas:** la base de esquiva es 22 y no 10 (con 10 los
fallos se quedaban en 12,6% y el objetivo es 20-35%), y el techo del clamp es 36 y no 40
(con 40, a nivel 10 los fallos se iban a 35,6%).

**Cómo se mide el equilibrio entre categorías:** cara a cara, con ambos armados y armas de
distinta clase. Medir "tener arma contra no tenerla" da 86% para cualquier categoría,
porque mide que un arma vale más que una maña, no que una categoría domine a otra.

## Ajustes de reglas

`plan.md` §6 y §7 llevan marcadas con _(Ajustado en Fase 1)_ las reglas que cambiaron
al medir el balance. Si vuelves a tocar los números del catálogo, corre `pnpm balance`:
es la única forma de saber si un cambio rompe algo.

## Despliegue (Fly.io + Supabase)

**Dos URLs de base de datos, y no son intercambiables:**

- `DATABASE_URL` la usa la aplicacion → el **pooler** de Supabase (puerto 6543).
- `DIRECT_URL` la usan las migraciones → la conexion **directa** (puerto 5432).
  A traves de un pooler en modo transaccion, `prisma migrate` falla.

Primer despliegue:

```bash
fly launch --no-deploy          # usa el fly.toml que ya existe
fly secrets set DATABASE_URL='...pooler...' DIRECT_URL='...directa...'
fly deploy
```

Las migraciones corren al arrancar el contenedor, asi que no hay paso aparte.
`PUBLIC_URL` en `fly.toml` debe apuntar al dominio real: se usa en `og:url`.

**El rate limit vive en memoria de cada maquina.** Con `min_machines_running = 0`
se reinicia en cada arranque en frio, y con varias maquinas el limite es por
maquina. Para un juego pequeno da igual; si deja de dar igual, hace falta un
almacen compartido.

## Antes de publicar

- El servidor sirve el frontend solo si existe `apps/web/dist`. En desarrollo no existe y
  de eso se encarga Vite con su proxy, asi que `pnpm dev` no cambia.
- **Pendiente** (plan.md §11): verificar "Camorra" contra el registro de marcas, y poner
  una direccion real en `CORREO_DE_CONTACTO_PENDIENTE` dentro de
  `apps/web/src/pages/Legal.tsx`. Nada de esto bloquea desplegar en privado.

## Pruebas end-to-end

`pnpm e2e` levanta el servidor de produccion contra `camorra_test`, limpia la base y
juega el ciclo completo en Chromium. Es lo mismo que se despliega, no una version de
mentira. Necesita `pnpm exec playwright install chromium` la primera vez.

## Estado

Fases 0 a 6 completas, salvo el despliegue en si, que necesita cuenta y dominio.
Fases futuras del plan: pupilos, torneos, ranking y sonido.
