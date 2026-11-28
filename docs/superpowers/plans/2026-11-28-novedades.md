# Novedades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página `/novedades` con aviso en la barra superior, y un script que saca la última entrada en Markdown para el release de GitHub.

**Architecture:** Los datos y la lógica pura (orden, "¿hay novedad?", almacén, Markdown, fecha) viven en `apps/web/src/novedades.ts`, probados con vitest. La página y el enlace de la barra los consumen; el e2e comprueba el punto.

**Tech Stack:** React 19, react-router 8, vitest, Playwright, tsx.

**Spec:** `docs/superpowers/specs/2026-11-28-novedades-design.md`

## Global Constraints

- Textos que ve el jugador con tildes; comentarios del código sin tildes (CLAUDE.md).
- Estilos solo en `apps/web/src/styles.css`, con los tokens existentes (`--oro`, `--e-*`, `--t-meta`, `--borde`, `--radio`…).
- Sin dependencias nuevas.
- `localStorage` siempre dentro de try/catch; sin almacén la página funciona y el punto sale.
- **No commitear**: Kevin pide el commit al final. Los pasos de commit de este plan se omiten.
- Clave de almacén: `camorra:novedades-vista`.

## Review Focus

- Almacén que lanza al leer o escribir (modo privado): el punto sale y no hay excepción. → test en Task 1.
- Valor guardado basura o una fecha que ya no existe: cuenta como no visto. → test en Task 1.
- Fecha `2026-11-28` mostrada como 27 por zona horaria: se formatea sin `Date`. → test en Task 1.
- Dos entradas con la misma fecha (dos despliegues un día): el test de invariantes lo impide. → Task 1.
- El punto debe apagarse al visitar la página aunque se llegue por enlace directo. → e2e en Task 2.

---

### Task 1: Datos, lógica y script de release

**Files:**
- Create: `apps/web/src/novedades.ts`, `apps/web/src/novedades.test.ts`, `apps/web/src/novedadesRelease.ts`
- Modify: `apps/web/package.json` (script `"novedades": "tsx src/novedadesRelease.ts"`)

**Interfaces:**
- Produces:
  - `type TipoNovedad = 'nuevo' | 'cambio' | 'arreglo'`
  - `interface Novedad { fecha: string; puntos: { tipo: TipoNovedad; texto: string }[] }`
  - `const NOVEDADES: readonly Novedad[]` (más nueva primero)
  - `const ETIQUETA: Record<TipoNovedad, string>` → `Nuevo`, `Cambio`, `Arreglo`
  - `formatearFecha(iso: string): string` → `'28 de noviembre de 2026'`
  - `hayNovedad(vista: string | null): boolean` → `vista !== NOVEDADES[0].fecha`
  - `leerVista(almacen?: Almacen | null): string | null`, `marcarVista(almacen?: Almacen | null): void`, con `Almacen = Pick<Storage,'getItem'|'setItem'>`, por defecto `window.localStorage` en try/catch (patrón de `enlacesPendientes.ts`)
  - `aMarkdown(n: Novedad): string`

- [ ] **Step 1: Tests en `novedades.test.ts`**
  - `NOVEDADES` no vacía; cada `fecha` cumple `/^\d{4}-\d{2}-\d{2}$/`, son únicas y estrictamente descendentes; cada entrada tiene ≥1 punto con `texto.trim()` no vacío.
  - `formatearFecha('2026-11-28') === '28 de noviembre de 2026'`, `formatearFecha('2027-01-01') === '1 de enero de 2027'`.
  - `hayNovedad(null)`, `hayNovedad('basura')`, `hayNovedad('2000-01-01')` → `true`; `hayNovedad(NOVEDADES[0].fecha)` → `false`.
  - Con almacén en memoria: `marcarVista(m)` y luego `leerVista(m) === NOVEDADES[0].fecha`. Con almacén cuyo `getItem`/`setItem` lanzan: `leerVista` devuelve `null` y `marcarVista` no lanza. Con `null`: igual.
  - `aMarkdown({ fecha: '2026-11-28', puntos: [{ tipo: 'nuevo', texto: 'A.' }, { tipo: 'arreglo', texto: 'B.' }] })` es exactamente `'## 28 de noviembre de 2026\n\n- **Nuevo:** A.\n- **Arreglo:** B.\n'`.

- [ ] **Step 2:** `pnpm vitest run apps/web/src/novedades.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar `novedades.ts`.** `formatearFecha` parte el ISO a mano con una tabla de meses (sin `Date`). Primera entrada, `2026-11-28`, con los puntos del boceto aprobado: tres armas nuevas; arrojadizas que se acaban; armas de mano que se rompen (banqueta la más frágil); desde el nivel 5 se sube más rápido y la barra puede verse distinta sin perder nada; quien muere de un contraataque ya no se parte en dos. `novedadesRelease.ts` imprime `aMarkdown(NOVEDADES[0])` por stdout.

- [ ] **Step 4:** `pnpm vitest run apps/web/src/novedades.test.ts` → PASS; `pnpm --filter @camorra/web novedades` imprime la entrada en Markdown.

### Task 2: Página, enlace con aviso y e2e

**Files:**
- Create: `apps/web/src/pages/Novedades.tsx`
- Modify: `apps/web/src/main.tsx` (ruta `/novedades`), `apps/web/src/ui.tsx` (enlace en `barra-nav` entre Ranking y `<ReportarProblema />`), `apps/web/src/styles.css`, `e2e/flujo.spec.ts`

**Interfaces:**
- Consumes: todo lo de Task 1.
- Produces: `NovedadesPage` (export), clase CSS `punto-novedad`.

- [ ] **Step 1: e2e en `flujo.spec.ts`**, en una página recién abierta: el enlace `getByRole('link', { name: /Novedades/ })` es visible y `page.locator('.punto-novedad')` tiene 1 elemento; tras ir a `/novedades` se ve `getByRole('heading', { name: 'Novedades' })` y el punto tiene 0 elementos; tras volver a `/` sigue en 0.

- [ ] **Step 2:** `pnpm e2e` → FAIL (no hay enlace).

- [ ] **Step 3: Implementar.**
  - `NovedadesPage`: `<Pagina volver={{ a: '/', texto: 'Volver' }} cabecera={{ titulo: 'Novedades' }}>`, una sección por entrada con `formatearFecha` como `h2` y la lista de puntos con su `ETIQUETA`; al final un párrafo "¿Algo no te convence? Cuéntanoslo." y `<ReportarProblema />`. Llama a `marcarVista()` en un `useEffect` al montar.
  - Enlace en la barra: `NavLink to="/novedades"`; el punto es `<span className="punto-novedad" aria-hidden="true" />` más un texto solo para lector (`" (hay novedades)"`, con la clase de solo lectores si existe en `styles.css`; si no, crearla). El estado sale de `hayNovedad(leerVista())` leído al montar y re-leído al cambiar `pathname` (`useLocation`), para que se apague al volver de la página.
  - El punto: círculo pequeño en `--oro`.

- [ ] **Step 4:** `pnpm e2e` → PASS; `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check` sobre los archivos tocados → limpio.

- [ ] **Step 5: Mirarlo en el navegador** a ancho de móvil (390 px) y escritorio: la barra no se desborda con el enlace nuevo. Si se desborda en móvil, acortar a lo que quepa sin quitar Reportar.
