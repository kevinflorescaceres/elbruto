# Luchadoras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al crear un peleón se elija hombre o mujer, con arte propio de luchadora y textos que concuerdan.

**Architecture:** Un campo opcional `gender` en `Appearance` (ausente = hombre) que el motor solo copia. El arte (`parts.ts`) decide según ese campo en `lookFrom` y `cabezaPorCapas`, así que la ficha (`Fighter.tsx`) y el combate (`pixiRig.ts`) lo reciben sin tocarlos. El servidor exige el campo al crear; la web lo pide en el formulario.

**Tech Stack:** TypeScript, pnpm workspaces, Zod, Fastify + Prisma 7, React + Vite, PixiJS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-28-luchadoras-design.md` — **toda la geometría (rutas de torsos, peinados, pestañas, claro del chirlo) está ahí**, en "Geometría aprobada". Este plan no la repite: cópiala de allí al pie de la letra.

## Global Constraints

- `ENGINE_VERSION` no cambia (sigue en 6): no se toca nada del combate.
- `packages/engine`: cero dependencias, sin `Math.random`, sin `Date`, sin imports no relativos (ESLint lo bloquea).
- El servidor no contiene reglas: cualquier decisión (incluido el sexo de un bot) vive en el motor.
- Todo lo que cruza la red se valida con Zod de `packages/shared`; `apps/web/src/api.ts` es el único que habla con el servidor.
- Textos que ve el jugador con tildes; comentarios del código sin tildes.
- Estilos solo en `apps/web/src/styles.css`, con los tokens existentes.
- Un peleón guardado sin `gender` se pinta **exactamente** como hoy.
- **Commits: no commitear salvo que Kevin lo pida** (regla suya). Antes de empezar, crear la rama `feat/luchadoras` desde `main`. Si Kevin pide commits: una línea, Conventional Commits en español, sin trailers de atribución.
- Verificación global al final: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm e2e`.

## Review Focus

1. **Peleones guardados sin `gender`** (todos los de hoy): se pintan idénticos a antes en ficha y combate. → Test en Task 3 (el `Look` sin `gender` es igual al de `gender: 'male'` y no cambia la ruta del torso ni de la cabeza).
2. **Un `gender` con un valor raro en la API** (`'otro'`, `''`, número): 400, y no se crea nada. → Test en Task 2.
3. **Renombrar desde `admin.ts` a una luchadora**: debe seguir siendo mujer. `admin.ts` no tiene tests; el sexo pasa por `createBrute(nuevo, gender)`, cubierto en Task 1. → Verificación manual en Task 2 (paso indicado).
4. **Escribir el nombre y no elegir sexo**: el botón Crear sigue deshabilitado y la ayuda dice por qué; al elegir, la vista previa pasa de dos figuras a una sin recargar. → e2e en Task 7.
5. **El combate (Pixi) de una luchadora**: el rig monta la cabeza con `cabezaPorCapas`, así que las pestañas tienen que estar en cada `caras[expresion]`, no solo en `parts.head`. → Test en Task 5 sobre `cabezaPorCapas`.

---

### Task 1: `gender` en el motor y en `shared`

**Files:**
- Modify: `packages/engine/src/types.ts` (interfaz `Appearance`, ~línea 68)
- Modify: `packages/engine/src/brute.ts` (`rollAppearance` ~96, `createBrute` ~118; añadir `botGender`)
- Modify: `packages/engine/src/index.ts` (exportar `Gender` y `botGender` si no salen ya por `export *`)
- Modify: `packages/shared/src/fight.ts` (`appearanceSchema`, ~línea 60)
- Test: `packages/engine/src/brute.test.ts`, `packages/engine/src/bots.test.ts`

**Interfaces:**
- Produces:
  - `export type Gender = 'male' | 'female'` (en `types.ts`)
  - `Appearance.gender?: Gender` (comentario: ausente = hombre; los creados antes no lo tienen)
  - `createBrute(name: string, gender: Gender = 'male'): Brute` — copia `gender` a `appearance.gender`, siempre explícito. **No consume del PRNG** (se añade tras `rollAppearance`, sin tirar).
  - `botGender(slug: string): Gender` — `hashString(\`bot:gender:${slug}\`) % 2 === 0 ? 'male' : 'female'`.
  - `appearanceSchema` con `gender: z.enum(['male', 'female']).optional()`; el `AssertSame` existente debe seguir compilando.

- [ ] **Step 1: Tests que fallan**

En `brute.test.ts`:
```ts
it('la mujer y el hombre del mismo nombre solo difieren en el sexo', () => {
  for (const n of ['Rosca la Brava', 'Matías Puñetas', 'Chirlo de la Cava']) {
    const h = createBrute(n, 'male');
    const m = createBrute(n, 'female');
    expect(m.appearance.gender).toBe('female');
    expect(h.appearance.gender).toBe('male');
    const { appearance: am, ...restoM } = m;
    const { appearance: ah, ...restoH } = h;
    expect(restoM).toEqual(restoH);
    expect({ ...am, gender: 'male' }).toEqual(ah);
  }
});
it('sin sexo, createBrute crea un hombre', () => {
  expect(createBrute('Nadie').appearance.gender).toBe('male');
});
```
En `bots.test.ts`:
```ts
it('el sexo de un bot sale de su slug y reparte mitad y mitad', () => {
  expect(botGender('pepe-el-gallo-3')).toBe(botGender('pepe-el-gallo-3'));
  const slugs = Array.from({ length: 400 }, (_, i) => `bot-${i}`);
  const mujeres = slugs.filter((s) => botGender(s) === 'female').length;
  expect(mujeres).toBeGreaterThan(160);
  expect(mujeres).toBeLessThan(240);
});
```

- [ ] **Step 2: Ver que fallan**

Run: `pnpm vitest run packages/engine/src/brute.test.ts packages/engine/src/bots.test.ts`
Expected: FAIL (`botGender` no existe / `gender` undefined).

- [ ] **Step 3: Implementar** `Gender`, `Appearance.gender`, el parámetro de `createBrute`, `botGender` y el campo del esquema, con las firmas de arriba.

- [ ] **Step 4: Verificar**

Run: `pnpm vitest run packages/engine && pnpm typecheck`
Expected: PASS. `apariencia.test.ts` ("ningún peleón conocido cambia de cara") sigue en verde: si falla, `gender` se ha colado en el PRNG.

---

### Task 2: Servidor — crear con sexo, renombrar conservándolo, bots mitad y mitad

**Files:**
- Modify: `packages/shared/src/api.ts:75` (`createBruteBody`)
- Modify: `apps/server/src/routes.ts:148,157`
- Modify: `apps/server/src/admin.ts:41-60` (`rename`)
- Modify: `apps/server/src/seed.ts:41`
- Test: `apps/server/src/api.test.ts`

**Interfaces:**
- Consumes: `createBrute(name, gender)`, `botGender(slug)`, `Gender` (Task 1).
- Produces: `createBruteBody` = `{ name, gender: z.enum(['male', 'female']), masterSlug? }` — `gender` **obligatorio**.

- [ ] **Step 1: Tests que fallan** en `api.test.ts`:
  - `'crear sin sexo da 400 y no crea nada'`: `POST /api/brutes` con `{ name: 'Sin Sexo' }` → `statusCode` 400; luego `GET /api/brutes/sin-sexo` → 404.
  - `'un sexo que no existe da 400'`: con `gender: 'otro'` → 400.
  - `'crear una luchadora la guarda y la devuelve como mujer'`: `{ name: 'Rosca la Brava', gender: 'female' }` → 201 (o el código que use hoy la ruta) y `body.brute.appearance.gender === 'female'`; `GET` de su ficha devuelve lo mismo.
  - Actualizar las 19 llamadas existentes a `POST /api/brutes` para que manden `gender: 'male'` (si hay helper de creación, solo en el helper).

- [ ] **Step 2: Ver que fallan**

Run: `pnpm --filter @camorra/server test -- api.test.ts`
Expected: FAIL en los tres tests nuevos.

- [ ] **Step 3: Implementar**
  - `createBruteBody` con `gender` obligatorio.
  - `routes.ts`: desestructurar `gender` y llamar `createBrute(name.trim(), gender)`.
  - `admin.ts rename`: leer el peleón por `slug` antes (`findUniqueOrThrow`), parsear su `appearance` con `appearanceSchema` y regenerar con `createBrute(nuevo, actual.gender ?? 'male')`.
  - `seed.ts`: `createBrute(name, botGender(slugify(name)))` (o el slug que ya calcula). Los bots existentes no se tocan: el `update` del seed sigue sin escribir `appearance`.

- [ ] **Step 4: Verificar**

Run: `pnpm --filter @camorra/server test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Verificación manual del rename** (Review Focus 3), contra la base de desarrollo:
  `pnpm admin rename <slug-de-una-luchadora> "Otro Nombre"` y comprobar con `psql camorra -c "select appearance->>'gender' from \"Brute\" where slug='otro-nombre'"` que sale `female`.

---

### Task 3: Arte — torso y rig de luchadora

**Files:**
- Modify: `apps/web/src/art/parts.ts` (junto a `COMPLEXIONES`/`TORSOS` ~230-256; `lookFrom` ~817)
- Test: `apps/web/src/art/art.test.ts`

**Interfaces:**
- Consumes: `Appearance.gender` (Task 1).
- Produces: `TORSOS_MUJER: Shape[][]` (privado), una por complexión en el orden de `COMPLEXIONES` (enjuta, recia, media): ruta del spec en `ropa`, escote redondo `M -7.5 -30.5 Q 0 -19 7.5 -30.5` en `piel`, y la faja de siempre con la `cintura` de la tabla del spec (9, 13, 10.5). `lookFrom` usa `TORSOS_MUJER` si `appearance.gender === 'female'`. **Los hombros del rig no cambian** (los de `COMPLEXIONES`: 13, 20, 17).

- [ ] **Step 1: Tests que fallan**
```ts
it('un peleon sin sexo guardado se pinta igual que hoy', () => {
  const b = createBrute('Chirlo de la Cava');
  const { gender: _g, ...sinSexo } = b.appearance;
  expect(lookFrom(sinSexo, b.slug)).toEqual(lookFrom({ ...sinSexo, gender: 'male' }, b.slug));
});
it('la luchadora lleva torso propio y los mismos hombros que el hombre', () => {
  const b = createBrute('Rosca la Brava');
  for (const body of [0, 1, 2]) {
    const h = lookFrom({ ...b.appearance, body, gender: 'male' }, b.slug);
    const m = lookFrom({ ...b.appearance, body, gender: 'female' }, b.slug);
    expect(m.parts.torso).not.toEqual(h.parts.torso);
    expect(m.rig).toEqual(h.rig);
  }
});
```

- [ ] **Step 2: Ver que fallan**

Run: `pnpm vitest run apps/web/src/art/art.test.ts`
Expected: FAIL en el segundo (el torso es el mismo).

- [ ] **Step 3: Implementar** `TORSOS_MUJER` y la rama en `lookFrom`.

- [ ] **Step 4: Verificar**

Run: `pnpm vitest run apps/web/src/art && pnpm typecheck`
Expected: PASS, incluidos los tests de art ya existentes.

---

### Task 4: Arte — peinados de luchadora y sin barba

**Files:**
- Modify: `apps/web/src/art/parts.ts` (junto a `PELOS` ~560; `Rasgos` ~638; `cabezaPorCapas` ~674; `lookFrom`)
- Test: `apps/web/src/art/art.test.ts`

**Interfaces:**
- Consumes: Task 3 (`lookFrom` ya lee `gender`).
- Produces:
  - `Rasgos.gender?: Gender` — `lookFrom` lo pasa desde `appearance.gender`.
  - `PELOS_MUJER: Peinado[]` (6, en el orden del spec: moño, trenza, coletas, melena, media melena, coleta alta), con `CAP_RAYA`, `CAP_ATRAS` y `goma(x, y, ancho)` como en el spec. Los círculos con el helper `circulo` existente.
  - Cada peinado lleva `bajoSombrero` dibujado contra `LINEA_DEL_SOMBRERO` (−31): lo que asoma bajo el ala. Es dibujo que queda al constructor; las piezas de `detras` ya se ven siempre.
  - En `cabezaPorCapas`, con `gender === 'female'`: pelo de `PELOS_MUJER` y **ninguna barba** (aunque `beard` guardado sea ≠ 0).

- [ ] **Step 1: Tests que fallan**
```ts
it('los seis peinados de luchadora son distintos entre si y de los del hombre', () => {
  const rasgos = { head: 0, beard: 0, brow: 0, mouth: 0, mark: 0 };
  const m = [0, 1, 2, 3, 4, 5].map((hair) => JSON.stringify(montarCabeza({ ...rasgos, hair, gender: 'female' })));
  const h = [0, 1, 2, 3, 4, 5].map((hair) => JSON.stringify(montarCabeza({ ...rasgos, hair })));
  expect(new Set(m).size).toBe(6);
  m.forEach((c) => expect(h).not.toContain(c));
});
it('una luchadora nunca lleva barba', () => {
  const rasgos = { head: 0, hair: 0, brow: 0, mouth: 0, mark: 0, gender: 'female' as const };
  const sin = montarCabeza({ ...rasgos, beard: 0 });
  for (const beard of [1, 2, 3, 4, 5]) expect(montarCabeza({ ...rasgos, beard })).toEqual(sin);
});
it('cada peinado de luchadora encaja bajo un sombrero', () => {
  // montarCabeza con un sombrero de prueba no revienta y no pinta la capa `encima`
  const rasgos = { head: 0, beard: 0, brow: 0, mouth: 0, mark: 0, gender: 'female' as const };
  for (const hair of [0, 1, 2, 3, 4, 5]) {
    expect(montarCabeza({ ...rasgos, hair }, [])).not.toEqual(montarCabeza({ ...rasgos, hair }));
  }
});
```
(Si el tercero no distingue en algún peinado porque `encima` y `bajoSombrero` coinciden a propósito, ajustarlo para ese índice y dejar dicho por qué.)

- [ ] **Step 2: Ver que fallan**

Run: `pnpm vitest run apps/web/src/art/art.test.ts`
Expected: FAIL (`gender` no existe en `Rasgos`).

- [ ] **Step 3: Implementar** `PELOS_MUJER`, `Rasgos.gender` y las dos ramas de `cabezaPorCapas`. El orden de pintado no cambia (spec y `ARTE-Y-TOKENS.md` §1.6).

- [ ] **Step 4: Verificar**

Run: `pnpm vitest run apps/web/src/art && pnpm typecheck`
Expected: PASS.

---

### Task 5: Arte — ojos de luchadora, ceja y claro del chirlo, y hojas de contacto

**Files:**
- Modify: `apps/web/src/art/parts.ts` (junto a `OJOS_*`, `CLARO_DEL_OJO` ~448; `cabezaPorCapas`)
- Modify: `apps/web/src/art/preview.ts` (hoja nueva y `cabezas.svg`)
- Test: `apps/web/src/art/art.test.ts`

**Interfaces:**
- Consumes: `Rasgos.gender` (Task 4).
- Produces, en `cabezaPorCapas` con `gender === 'female'`:
  - `PESTANAS: Record<Expresion, Shape[]>` (privado), con las formas de la tabla del spec, ojo izquierdo y espejo con `parDeOjos`; trazo 1,3, párpado 1,6, todo `oscuro`. `dolor` y `derrotado` vacías. Se añaden a cada `caras[expresion]` **después** de los ojos.
  - Las cejas del personaje (`CEJAS[brow]`) suben 1,5 (`desplaza(d, 0, -1.5)`) en todas las caras que las llevan. `CEJAS_EN_V` y `CEJA_ENARCADA` no se mueven.
  - Si la marca lleva chirlo (`marca.enLaPiel.length > 0`), `CLARO_DEL_OJO_MUJER` (ruta del spec) en vez de `CLARO_DEL_OJO`.

- [ ] **Step 1: Tests que fallan**
```ts
const rasgosM = { head: 0, hair: 0, beard: 0, brow: 0, mouth: 0, mark: 0, gender: 'female' as const };
it('la luchadora lleva pestanas en cada gesto salvo dolor y derrotado', () => {
  const h = cabezaPorCapas({ ...rasgosM, gender: undefined });
  const m = cabezaPorCapas(rasgosM);
  for (const e of EXPRESIONES) {
    const extra = m.caras[e].length - h.caras[e].length;
    if (e === 'dolor' || e === 'derrotado') expect(extra).toBe(0);
    else expect(extra).toBeGreaterThan(0);
  }
});
it('la ceja de la luchadora va 1,5 mas alta', () => {
  const ceja = (r: Rasgos) => cabezaPorCapas(r).caras.neutral[0]!.d;
  expect(ceja(rasgosM)).not.toEqual(ceja({ ...rasgosM, gender: undefined }));
});
it('con chirlo, la luchadora lleva el claro grande', () => {
  const m = cabezaPorCapas({ ...rasgosM, mark: 3 });
  const h = cabezaPorCapas({ ...rasgosM, mark: 3, gender: undefined });
  expect(m.caras.neutral[0]).not.toEqual(h.caras.neutral[0]);
});
```
(`caras.neutral[0]` es el claro cuando hay chirlo y la primera ceja cuando no: comprobar el índice con el orden real de `cabezaPorCapas` y ajustar.)

- [ ] **Step 2: Ver que fallan**

Run: `pnpm vitest run apps/web/src/art/art.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** las pestañas, la ceja y el claro.

- [ ] **Step 4: Hojas de contacto** en `preview.ts`:
  - `luchadoras.svg`: los seis peinados de mujer sobre las cuatro cabezas y las tres complexiones, y las siete expresiones de tres luchadoras (sin marca, con chirlo `mark: 3`, con parche `mark: 4`).
  - `cabezas.svg`: añadir los seis peinados de mujer con los sombreros de prueba ya existentes (`GALIBOS`).

Run: `pnpm --filter @camorra/web art /tmp/art-luchadoras` y rasterizar `luchadoras.svg` y `cabezas.svg` (ver `CLAUDE.md`, sección Arte). Mirar las hojas: ninguna pestaña cruza la ceja, la trenza se ve, la cicatriz no se enreda con las pestañas y nada asoma por encima de un ala de sombrero.

- [ ] **Step 5: Verificar**

Run: `pnpm vitest run apps/web/src && pnpm typecheck && pnpm lint`
Expected: PASS (`timeline.test.ts` incluido).

---

### Task 6: Textos que concuerdan

**Files:**
- Create: `apps/web/src/genero.ts`
- Test: `apps/web/src/genero.test.ts`
- Modify: `apps/web/src/pages/Brute.tsx:53-54,170`, `apps/web/src/pages/Ranking.tsx:99`, `apps/web/src/pages/Home.tsx:188`, `apps/web/src/art/Fighter.tsx:170`

**Interfaces:**
- Consumes: `Gender`, `Appearance` (Task 1).
- Produces: `segun<T>(gender: Gender | undefined, hombre: T, mujer: T): T` — `gender === 'female' ? mujer : hombre`.

- [ ] **Step 1: Test que falla**
```ts
it('elige la forma de mujer solo si es mujer', () => {
  expect(segun('female', 'peleón', 'peleona')).toBe('peleona');
  expect(segun('male', 'peleón', 'peleona')).toBe('peleón');
  expect(segun(undefined, 'peleón', 'peleona')).toBe('peleón');
});
```

- [ ] **Step 2: Ver que falla** — Run: `pnpm vitest run apps/web/src/genero.test.ts` → FAIL.

- [ ] **Step 3: Implementar `segun`** y aplicarlo:
  - `Brute.tsx`: "Qué problema hay con este peleón" / "con esta peleona" (placeholder y `aria-label`); "peleón de la casa" / "peleona de la casa". Sexo: `b.appearance.gender`.
  - `Ranking.tsx`: "Tu peleón" / "Tu peleona". El sexo sale de `me.data.brutes` buscando por `slug` (la fila del ranking no trae apariencia). Si la página no tiene ya `me`, usar el mismo hook que `Home.tsx`.
  - `Home.tsx:188`: "es un peleón de la casa" / "es una peleona de la casa" con `maestro.data.appearance.gender`.
  - `Fighter.tsx`: `aria-label` "Retrato del peleón" / "Retrato de la peleona" con `appearance.gender`.
  - Pasar `grep -rn "peleón" apps/web/src` y revisar que no queda otro texto **sobre un peleón concreto**; lo genérico se queda (spec, sección Textos).

- [ ] **Step 4: Verificar** — Run: `pnpm vitest run apps/web && pnpm typecheck` → PASS.

---

### Task 7: Formulario, portada y e2e

**Files:**
- Modify: `apps/web/src/api.ts:59-60`
- Modify: `apps/web/src/CrearPeleon.tsx` (`useCrearPeleon`, `VistaPrevia`, `FormularioNombre`) y quien los use (`pages/Home.tsx`, `pages/Fight.tsx`, `pages/Brute.tsx`)
- Modify: `apps/web/src/pages/Home.tsx:22` (`MUESTRA`)
- Modify: `apps/web/src/styles.css`
- Modify: `e2e/flujo.spec.ts`

**Interfaces:**
- Consumes: `createBruteBody` con `gender` (Task 2), `createBrute(name, gender)` (Task 1).
- Produces:
  - `api.createBrute(name: string, gender: Gender, masterSlug?: string)`.
  - `useCrearPeleon` devuelve además `gender: Gender | null` y `setGender`. `gender` empieza en `null` y vuelve a `null` tras crear.
  - `VistaPrevia({ name, ayuda, gender })`: con `gender === null`, dos `Fighter` (hombre y mujer del mismo nombre) a `height={56}` lado a lado; con sexo, uno solo a `height={72}` como hoy.
  - En `FormularioNombre`, tras el input: un grupo `role="radiogroup"` con `aria-label="Sexo"` y dos botones `role="radio"` con `aria-checked`, textos **"Hombre"** y **"Mujer"**, ninguno marcado al entrar; flechas izquierda/derecha cambian la selección.
  - Crear deshabilitado si `!ayuda.valido || gender === null || create.isPending`. Si el nombre es válido y falta el sexo, la ayuda (`#nombre-ayuda`) dice **"Elige si es hombre o mujer."**
  - `MUESTRA = [createBrute('Rosca la Brava', 'female'), createBrute('Matías Puñetas', 'male')]`.

- [ ] **Step 1: e2e que falla** en `flujo.spec.ts`, en `crearPeleon` (y un test propio):
```ts
await page.getByLabel('Nombre del peleón').fill(suyo);
await expect(page.getByRole('button', { name: 'Crear' })).toBeDisabled();
await expect(page.getByText('Elige si es hombre o mujer.')).toBeVisible();
await page.getByRole('radio', { name: 'Mujer' }).click();
await expect(page.getByRole('radio', { name: 'Mujer' })).toHaveAttribute('aria-checked', 'true');
await page.getByRole('button', { name: 'Crear' }).click();
```
Y en la ficha de esa luchadora: `await expect(page.getByLabel('Retrato de la peleona').first()).toBeVisible();`

- [ ] **Step 2: Ver que falla** — Run: `pnpm e2e` → FAIL (no hay radio "Mujer").

- [ ] **Step 3: Implementar** `api.ts`, el estado, el grupo de radios, la vista previa doble, la ayuda y la muestra de portada. Estilos del grupo en `styles.css` con los tokens existentes (mismo lenguaje que `Boton`); el estado marcado se distingue por algo más que el color.

- [ ] **Step 4: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e`
Expected: PASS. Mirar el formulario en el navegador (`pnpm dev`) a 390 px y a escritorio: los dos botones caben junto al campo o debajo sin desbordar, y la vista previa doble no empuja la ayuda fuera de su sitio.

---

### Task 8: Documentación y novedad

**Files:**
- Modify: `ARTE-Y-TOKENS.md` (§1.6: subsección "Luchadoras")
- Modify: `CLAUDE.md` (sección Arte)
- Modify: `apps/web/src/novedades.ts`

- [ ] **Step 1:** `ARTE-Y-TOKENS.md` §1.6: torsos de luchadora (cintura y cadera, mismos hombros, escote redondo, sin línea de pecho), los seis peinados con la trenza por el lado `-x` y por qué, las pestañas por expresión (sin pestañas en `dolor`/`derrotado` y por qué), la ceja +1,5, el flequillo de la melena en −33 y el claro grande del chirlo. Rutas: "viven en `parts.ts`", como el resto de la sección.
- [ ] **Step 2:** `CLAUDE.md`, sección Arte: una línea: "`Appearance.gender` (`'male' | 'female'`) elige cuerpo y cabeza en `parts.ts`; ausente es hombre, así los peleones de antes no cambian. La elige el jugador al crear y no se puede cambiar."
- [ ] **Step 3:** `novedades.ts`: entrada `nuevo` en la fecha del despliegue (si coincide con una entrada existente, como punto de esa): "Ya puedes crear luchadoras: al poner el nombre, elige si tu peleón es hombre o mujer." (el constructor puede pulir la frase).
- [ ] **Step 4: Verificar** — Run: `pnpm vitest run apps/web/src/novedades.test.ts && pnpm format` → PASS.
