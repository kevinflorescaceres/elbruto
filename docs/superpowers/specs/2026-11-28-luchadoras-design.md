# Luchadoras — diseño

Fecha: 2026-11-28. Estado: aspecto aprobado en el navegador; documento pendiente de aprobación.

## Intención

Que quien crea un peleón **elija si es hombre o mujer**. Hoy no hay opción: el arte solo tiene
cuerpos de hombre (torsos rectos, el recio con barriga, barba en 5 de cada 6) y hasta la muestra de
la portada, "Rosca la Brava", sale como un tipo.

## Objetivos

- Elegir hombre o mujer en el formulario del nombre, con la vista previa al día.
- Una luchadora se lee como mujer a golpe de vista, también en combate, sin dejar de ser una
  peleona robusta y con mala uva (cicatrices, parche, boca mellada, canas).
- Los bots nuevos salen mitad y mitad.

## No objetivos

- **No afecta al combate.** Ni estadísticas, ni vida, ni nada del motor de reglas.
  `ENGINE_VERSION` se queda en 6.
- **Los peleones ya creados no pueden cambiar de sexo.** La elección vale solo al crear.
- Sin sombreros, sin accesorios nuevos, sin tocar el arte de los hombres.

## Anti-objetivos (fracaso aunque funcione)

- Que crear un peleón de mujer cambie sus estadísticas o cualquier otro rasgo de la cara respecto
  al hombre del mismo nombre: deben parecerse "como hermanos".
- Que un peleón ya creado cambie de cara al desplegar.
- Una opción preseleccionada que decida por el jugador.
- Una luchadora sexualizada: la silueta se marca con cintura y cadera, no con pecho.

## Restricciones (del proyecto)

- `packages/engine`: sin dependencias, sin `Math.random`/`Date`. Nada de reglas en `apps/server`.
- Todo lo que cruza la red se valida con Zod de `packages/shared`, en los dos lados.
- `src/api.ts` es el único sitio que habla con el servidor.
- **El arte son datos** (`art/parts.ts`), y **dos renderers, un origen**: `Fighter.tsx` y
  `pixiRig.ts` montan el peleón con la misma `lookFrom` y la cabeza con `cabezaPorCapas`.
- La apariencia se congela en la BD al crear (`Brute.appearance` es `Json`).
- Las animaciones se solapan: las caras se cambian enteras por expresión (`caras[expresion]`).
- Textos de la interfaz con tildes; comentarios del código sin ellas.

## Enfoques considerados

1. **Campo opcional en `Appearance` y el arte decide en `parts.ts`** — elegido. Sin migración
   (`appearance` ya es JSON), los peleones existentes no lo tienen y se pintan como hombres, y los
   dos renderers lo reciben gratis porque leen `lookFrom`/`cabezaPorCapas`.
2. Tablas de arte aparte en la web para mujeres — descartado: rompe "dos renderers, un origen" y
   duplica la lógica de montaje.
3. Columna nueva en `Brute` — descartado: migración para algo que es apariencia y cabe en el JSON
   que ya existe.

## Lo decidido con Kevin

- La elige el jugador en el formulario del nombre; los ya creados se quedan como están (hombres).
- Bots: mitad y mitad.
- Dirección de arte **B, "silueta propia"**, afinada en el navegador:
  - Torso propio por complexión (enjuta, recia, media): cintura marcada y cadera, mismos
    hombros que el hombre. **Sin línea de pecho.** Escote **redondo** (el del hombre es en pico).
  - Seis peinados propios, uno por valor de `hair`: moño, trenza (por el hombro de **atrás**),
    coletas, melena con flequillo, media melena recogida bajo la mandíbula, coleta alta.
  - Ninguna barba.
  - Ojos: **párpado** (variante B): línea de párpado sobre el ojo y dos pestañas en la punta.
    Cada expresión lleva la suya (tabla abajo); `dolor` y `derrotado` sin pestañas.
  - La ceja del personaje sube 1,5 unidades para dejar sitio a las pestañas.
  - Con chirlo, el claro de piel del ojo derecho crece para cubrir párpado y pestañas: la cicatriz
    se corta limpia alrededor del ojo, asoma sobre la ceja y sigue por la mejilla.
  - Se quedan cicatrices, parche, boca mellada y canas.
- Los hombres no cambian. Caso conocido y aceptado: un hombre con melena y sin barba visible
  (sin barba, o patillas tapadas por la melena; ~1 de cada 18) se parece a una luchadora con melena.

## Diseño

### Datos (motor y `shared`)

- `Appearance` gana `gender?: 'male' | 'female'` _(nombre del campo: decisión mía; los demás campos
  de `Appearance` van en inglés)_. **Ausente = `male`.** Opcional para no tocar a los existentes ni
  migrar nada; los nuevos lo guardan siempre explícito.
- `createBrute(name, gender = 'male')`: **opcional en el motor**, por defecto `'male'` _(decisión mía:
  hay una docena de llamadas internas —bots, balance, ritmo, `Escenario.tsx`, `preview.ts`— a las que
  el sexo les da igual; donde importa, el servidor lo exige)_. El `gender` solo se copia a `appearance`. **No consume del PRNG ni
  altera ningún otro campo**: estadísticas, maña inicial y el resto de la apariencia son idénticos
  entre el hombre y la mujer del mismo nombre. Test que lo fije.
- `appearanceSchema` añade `gender: z.enum(['male', 'female']).optional()`; el `AssertSame` con el
  tipo del motor lo mantiene sincronizado.
- `beard` se sigue guardando tal cual sale de su semilla; **es el arte quien no pinta barba a una
  mujer** _(decisión mía: el motor no sabe de dibujo; así `beard` sigue siendo "la semilla del
  nombre" para todos)_.

### API y servidor

- `createBruteBody` añade `gender: z.enum(['male', 'female'])`, **obligatorio**. Sin él, 400 con el
  mensaje de validación habitual. El cliente web se despliega a la vez que el servidor.
- `routes.ts`: `createBrute(name.trim(), gender)`.
- `admin.ts rename`: regenera la apariencia del nombre nuevo, como hoy, pero conservando el sexo
  guardado: `createBrute(nuevo, actual.appearance.gender ?? 'male')` (hay que leer el peleón antes).
- `seed.ts`: el sexo de cada bot sale de su slug, determinista:
  `hashString(\`bot:gender:${slug}\`) % 2`. Solo afecta a los bots que el seed **crea**: los
  existentes no se tocan (decidido con Kevin). El seed aún no se ha corrido en producción, así que
  allí todos los bots saldrán ya mitad y mitad.
- `api.ts` (web): `createBrute(name, gender, masterSlug?)`.

### Formulario (`CrearPeleon.tsx`)

- Junto al nombre, un grupo de dos botones **Hombre / Mujer** (`role="radiogroup"`, cada uno
  `role="radio"` con `aria-checked`, navegable con teclado). **Ninguno marcado al entrar.**
- El botón de crear está deshabilitado hasta que haya nombre válido **y** sexo elegido, con una
  ayuda que lo diga ("Elige si es hombre o mujer").
- Vista previa: mientras no se elija, enseña **los dos** (hombre y mujer del mismo nombre, más
  pequeños, lado a lado); al elegir, se queda con el elegido en su tamaño de siempre _(decisión
  mía: ayuda a elegir y enseña que el resto de la cara no cambia)_.
- `useCrearPeleon` guarda el `gender` y lo resetea tras crear, como el nombre.
- Estilos en `styles.css`, con los tokens existentes; sin framework.

### Arte (`apps/web/src/art/parts.ts`)

`lookFrom` lee `appearance.gender`. Con `'female'`:

- `parts.torso` = torso de luchadora de su complexión. **El `rig` usa los mismos hombros que el hombre
  (13, 20, 17, de `COMPLEXIONES`)** _(decisión mía: los bocetos usaban 13/19/16, pero los hombros
  mueven brazos y armas en todas las poses de los dos renderers; con los mismos no hay que revisar
  poses ni `timeline.test.ts`, y la manga tapa la diferencia de 1 unidad con la ruta del torso)_.
- La cabeza sale de `cabezaPorCapas` con el rasgo nuevo `gender` en `Rasgos`, que:
  - usa `PELOS_MUJER[hair]` en vez de `PELOS[hair]`;
  - no pinta barba;
  - sube 1,5 las cejas del personaje (con `desplaza`, que ya existe);
  - añade a cada `caras[expresion]` sus pestañas (tabla abajo), después de los ojos;
  - si la marca es el chirlo, cambia `CLARO_DEL_OJO` por el claro ampliado.
- Las mujeres comparten todo lo demás: cabezas, cejas, bocas, marcas, brazos, piernas, paleta.
- Cada peinado de mujer necesita también su capa `bajoSombrero` (lo que asoma bajo un ala),
  aunque aún no haya sombreros, y la hoja `cabezas.svg` debe probarlos. _(Trabajo de dibujo que
  queda al constructor: lo que asoma de cada peinado bajo `LINEA_DEL_SOMBRERO`; las piezas de
  `detras` se ven siempre.)_

Geometría aprobada (coordenadas de cada parte, como en `parts.ts`; `circulo` es el helper existente):

**Torsos** — `{ ruta, cintura, hombro }`, más escote `M -7.5 -30.5 Q 0 -19 7.5 -30.5` en `piel` y la
faja de siempre a la medida de `cintura`:

| Complexión | Ruta | Cintura |
| --- | --- | --- |
| enjuta | `M -11.5 3 Q -13 -3 -8.5 -8 Q -15.5 -13 -15 -21 Q -15 -30 -8 -30 L 8 -30 Q 15 -30 15 -21 Q 15.5 -13 8.5 -8 Q 13 -3 11.5 3 Z` | 9 |
| recia | `M -15.5 3 Q -18.5 -3 -12.5 -8 Q -21.5 -13 -21 -20 Q -22 -30 -12 -31 L 12 -31 Q 22 -30 21 -20 Q 21.5 -13 12.5 -8 Q 18.5 -3 15.5 3 Z` | 13 |
| media | `M -13 3 Q -15.5 -3 -10 -8 Q -18.5 -13 -18 -20 Q -19 -30 -10 -31 L 10 -31 Q 19 -30 18 -20 Q 18.5 -13 10 -8 Q 15.5 -3 13 3 Z` | 10.5 |

**Peinados** (`detras` / `encima`); `goma(x, y, ancho)` es un rectángulo de alto 2,8 centrado en
`(x, y)` en `ropa2`:

- Casquetes: `CAP_RAYA` = `M -18.5 -25 Q -19 -44.5 0 -44.5 Q 19 -44.5 18.5 -25 Q 15 -35 3 -37 L 0 -34.5 Q -8 -37.5 -18.5 -25 Z`;
  `CAP_ATRAS` = `M -18.5 -26 Q -19 -44.5 0 -44.5 Q 19 -44.5 18.5 -26 Q 15 -36 0 -37 Q -15 -36 -18.5 -26 Z`.
- 0 moño: encima `circulo(0, -49, 7.5)`, `goma(0, -42.5, 4.5)` y después `CAP_ATRAS` (el moño va en `encima`, no en `detras`, para que un sombrero lo tape; su `bajoSombrero` no lo lleva).
- 1 trenza: detrás `M -10 -38 Q -22 -34 -21 -22 Q -20 -12 -16 -6 L -11 -8 Q -15 -16 -14 -26 Z`;
  encima `CAP_RAYA`, `circulo(-15, -3, 4.6)`, `circulo(-14.5, 5, 4.4)`, `circulo(-14, 12.5, 4)`,
  `goma(-14, 17.5, 3)`, punta `M -16.5 19 L -11.5 19 L -10.5 24 L -14 22.5 L -17.5 24 Z`.
  Va por el lado `-x` porque en `+x` la tapa el brazo de delante.
- 2 coletas: detrás `M -16 -35 Q -33 -36 -32 -18 Q -31 -8 -26 -4 Q -27 -20 -16 -27 Z` y su espejo,
  `goma(±18.5, -31, 2.5)`; encima `CAP_RAYA`.
- 3 melena: detrás `M -20.5 -26 Q -21.5 -46 0 -46 Q 21.5 -46 20.5 -26 L 23 8 Q 18 11 14 4 L 13 -5 L -13 -5 L -14 4 Q -18 11 -23 8 Z`;
  encima (flequillo) `M -18.5 -25 Q -19 -44.5 0 -44.5 Q 19 -44.5 18.5 -25 L 16 -33 L -16 -33 Z`.
  El flequillo acaba en −33 para no tapar la ceja subida.
- 4 media melena: detrás `M -21 -26 Q -21.5 -46 0 -46 Q 21.5 -46 21 -26 L 21.5 -12 Q 21.5 -5 14.5 -6.5 Q 17 -14 14 -21 L -14 -21 Q -17 -14 -14.5 -6.5 Q -21.5 -5 -21.5 -12 Z`;
  encima `M -18.5 -24 Q -19 -44.5 0 -44.5 Q 19 -44.5 18.5 -26 Q 12 -33 -4 -32 Q -14 -31 -18.5 -24 Z`.
- 5 coleta alta: detrás `M 4 -44 Q 24 -54 31 -38 Q 35 -26 28 -14 Q 27 -30 14 -38 Z`, `goma(9, -42, 3)`;
  encima `CAP_ATRAS`.

**Pestañas** — ojo izquierdo, el derecho por espejo (`parDeOjos`); todo `oscuro`, trazo 1,3 salvo
el párpado (1,6):

| Expresión | Formas |
| --- | --- |
| neutral, esfuerzo | párpado `M -10.6 -24.6 Q -9.6 -27.6 -6 -27.2 Q -4.4 -26.9 -3.6 -25.6`; pestañas `M -10.3 -26 L -12.4 -27.4`, `M -9 -27.3 L -10.1 -28.6` (acortada al implementar: hasta −29,2 tocaba la ceja subida) |
| parpadeo | `M -9.4 -23.1 L -11.3 -21.5`, `M -8 -22.4 L -9 -20.3` (cuelgan) |
| alegria | `M -9.5 -23.8 L -11.6 -25`, `M -8.6 -25.1 L -10 -27` |
| socarrona | `M -9.8 -24.8 L -11.8 -26`, `M -8.6 -25 L -9.6 -27` (del párpado entornado) |
| dolor, derrotado | ninguna (en `> <` salían como brotes en las puntas) |

**Claro ampliado del chirlo** (sustituye a `CLARO_DEL_OJO` en mujeres):
`M 2.6 -24 Q 2.6 -30.6 8 -30.6 Q 13.4 -30.6 13.4 -24.5 Q 13.4 -20.6 8 -20.6 Q 2.6 -20.6 2.6 -24 Z`, `piel`, sin trazo.

### Tests

- Motor: `createBrute(n, 'female')` y `createBrute(n, 'male')` solo difieren en `appearance.gender`.
- `shared`/servidor: `POST /api/brutes` sin `gender` → 400; con `gender` se guarda y vuelve en la ficha.
  Un peleón guardado sin `gender` se sigue leyendo (esquema opcional).
- `art.test.ts`: los seis peinados de mujer son distintos entre sí; ninguna mujer pinta barba;
  cada expresión de mujer lleva sus pestañas (y `dolor`/`derrotado` ninguna); una apariencia sin
  `gender` produce exactamente el mismo `Look` que hoy (los hombres no cambian).
- `timeline.test.ts`/`fightScene`: nada nuevo salvo que se rompa algo.
- e2e: el ciclo completo elige sexo al crear.
- Hojas de contacto (`pnpm --filter @camorra/web art`): una hoja nueva `luchadoras.svg` (los seis
  peinados en las cuatro cabezas y las tres complexiones, y las siete expresiones con y sin chirlo
  y parche); `cabezas.svg` incluye los peinados de mujer con los sombreros de prueba.

### Portada

- `Home.tsx`: la muestra pasa a `createBrute('Rosca la Brava', 'female')` y
  `createBrute('Matías Puñetas', 'male')` _(decisión mía: es la primera cara que se ve)_.

### Textos

- El log del combate (`fightLines.ts`) y las pantallas de resultado ya son neutros
  ("Gana X", "X se desploma", "X encaja 5"): no se tocan.
- **Regla (decidida con Kevin): donde un texto habla de un peleón concreto cuyo sexo se conoce,
  concuerda** (peleón/peleona, el/la, del/de la). Lo genérico se queda en masculino genérico:
  antes de crear ("Pon un nombre y tendrás un peleón"), plurales ("Mis peleones"), "un peleón"
  indefinido, cabeceras de tabla y títulos de página.
- Un helper puro en la web, p. ej. `src/genero.ts`: `segun(gender, 'peleón', 'peleona')`, con
  `gender` ausente = hombre. Sin tabla de traducciones: dos palabras por sitio.
- Sitios encontrados (el constructor revisa que no falte ninguno con `grep -rn "peleón"`):
  - `pages/Brute.tsx`: "Qué problema hay con este peleón" (placeholder y `aria-label`) y
    "peleón de la casa".
  - `pages/Ranking.tsx`: la etiqueta "Tu peleón" de la fila propia. La fila del ranking no trae
    apariencia, pero es uno de los míos: el sexo sale de `me.brutes` por slug. Sin cambio de API.
  - `pages/Home.tsx`: "`{maestro}` es un peleón de la casa…".
  - `art/Fighter.tsx`: `aria-label="Retrato del peleón"`.

### Documentación### Documentación

- `ARTE-Y-TOKENS.md` §1.6: luchadoras (torsos, peinados, pestañas, ceja, claro del chirlo).
- `CLAUDE.md` (Arte): una línea con el campo `gender` y que ausente es hombre.
- Página de novedades (`novedades.ts`): entrada "Ya puedes crear luchadoras" _(decisión mía)_.

## Lo que queda al constructor

- Rutas `bajoSombrero` de los seis peinados de mujer.
- Copia exacta de la ayuda del formulario y del texto de la novedad (español correcto, con tildes).
- Detalles de estilo del grupo Hombre/Mujer dentro de los tokens existentes.

