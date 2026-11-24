# ARTE-Y-TOKENS.md — variedad de peleones y tokens de interfaz

Responde a las preguntas abiertas de `docs/CONTEXTO-DISENO.md` y fija lo acordado. Manda sobre
`plan.md` §11 solo en lo que aquí se detalle; las restricciones de contenido original siguen
intactas.

---

## Parte 1 — Más variedad de peleones

El problema medido: de 17.280 apariencias que genera el motor, solo 3.840 se pueden dibujar.
Cinco de cada seis peleones son el clon visual de otro.

### 1.1 Primero, cerrar el hueco que ya existía

Hecho. Antes de añadir nada nuevo se dibujaron las piezas que faltaban para los rangos de
entonces:

| Constante                 | Antes | Ahora | Qué se añadió                                   |
| ------------------------- | ----- | ----- | ----------------------------------------------- |
| `TORSOS` / `COMPLEXIONES` | 2     | **3** | una complexión intermedia entre enjuto y recio  |
| `CABEZAS`                 | 2     | **4** | una alargada y una ancha de pómulos altos       |
| `PELOS`                   | 4     | **6** | entradas con coleta, y calva con corona de pelo |

Con eso solo, las 17.280 apariencias pasaron a ser todas distintas, sin tocar el motor, sin
migrar nada y sin afectar a los peleones ya creados. Las rutas actuales, en §1.6.

### 1.2 Campos nuevos de `Appearance`

Hechos (`packages/engine/src/types.ts`), opcionales para no tocar a los ya creados (§1.3).
Cuatro campos, todos en la cara, que es donde se mira:

| Campo   | Rango | Variantes | Notas                                                                        |
| ------- | ----- | --------- | ---------------------------------------------------------------------------- |
| `brow`  | 0–3   | 4 cejas   | recta, caída, arqueada, partida por cicatriz                                 |
| `mouth` | 0–3   | 4 bocas   | la actual, torcida, apretada, mellada                                        |
| `beard` | 0–5   | 6         | sin barba, perilla, bigote, patillas, barba corta, barba cerrada             |
| `mark`  | 0–5   | 6         | nada, nada, nada, chirlo en la mejilla, parche en el ojo, venda en la frente |

`mark` lleva tres valores vacíos a propósito: la mitad de los peleones no debe tener marca, o
deja de ser una marca.

Resultado: 17.280 × 4 × 4 × 6 × 6 = **9.953.280 apariencias**, todas dibujables.

### 1.3 Cómo derivarlas sin romper a nadie — importante

El contexto señala que el orden de consumo del PRNG es frágil: meter una tirada antes de
`rollAppearance` cambia la cara de todos. Con campos nuevos ese problema se repite en cada
ampliación futura.

**Solución: que cada campo tenga su propia semilla, independiente del orden.**

```
fieldSeed(slug, campo) = hashString(slug + ':' + campo)
appearance.beard = mulberry32(fieldSeed(slug, 'beard'))() escalado al rango
```

Ventajas concretas:

- Añadir un campo mañana no toca ningún campo existente. Nunca más.
- Los peleones ya creados obtienen sus campos nuevos **calculados desde su propio slug**, no un
  valor por defecto: quedan con cara coherente, no todos con la misma barba.
- No hace falta backfill: `lookFrom()` calcula el campo si falta en el JSON guardado. Se
  persiste la próxima vez que se escriba el peleón.
- `rollAppearance` se reescribe con este esquema **manteniendo los valores actuales de
  `body`, `head`, `hair`, `skinColor`, `hairColor` y `clothColor`**, o los peleones existentes
  cambian de cara. Verificarlo con un test que fije la apariencia de una lista de nombres
  conocidos y falle si alguna cambia.

### 1.4 Reglas de dibujo

- Las piezas de cara (`brow`, `mouth`, `beard`, `mark`) son formas dentro de la lista de
  `head`. El orden de pintado está en §1.6 y lo aplica `montarCabeza` en `parts.ts`.
- **Las cuatro cabezas comparten la calota.** Solo cambian de la sien para abajo; cualquier
  pelo o sombrero se dibuja una vez contra la calota común y encaja en las cuatro.
- `beard` usa el tinte `pelo`, así queda del mismo color que la cabeza sin trabajo extra.
- `mark`: el chirlo es una línea `oscuro`; el parche, `oscuro`; la venda, `trapo`. Cada marca
  dice en qué capa va: lo que está **en la piel** (el chirlo) se pinta antes que el pelo, y lo
  que se **lleva puesto** (parche, venda), después de los ojos.
- **Colisiones:** ninguna barba puede solaparse con la boca mellada de forma que la tape. Si
  ocurre en alguna combinación, ajustar la ruta de la barba, no excluir la combinación: excluir
  rompe el reparto uniforme.
- Las rutas de cara sí pueden llevar arcos: `scalePath` solo se aplica a armas.
- Cada pieza nueva se revisa en la hoja de contacto (`pnpm --filter @camorra/web art`) antes de
  darla por buena.

### 1.5 Lo que NO se hace

- **La apariencia no cambia con el nivel.** Las cicatrices tras muchas derrotas son una regla de
  juego, no arte, y no entran ahora. `Appearance` sigue congelada al crear.
- No se añaden accesorios que dependan del equipo (llevar sombrero por tener un arma, etc.).

### 1.6 Geometría del peleón

**Las rutas viven en `apps/web/src/art/parts.ts`, y solo ahí.** Esta sección copiaba las rutas
originales del lienzo de diseño. Se rehicieron el 2026-11-24 (cuerpo con hombros y complexiones
que se distinguen, cabeza sobre una calota común) y la copia dejó de servir. Aquí quedan las
medidas y las reglas que no se ven leyendo una ruta suelta.

Cada parte del rig usa sus propias coordenadas: origen en su articulación y la altura crece
hacia −y. No son coordenadas absolutas del peleón.

**Dos tintes** en la unión `Tinte`:

```ts
cuero: '#5b3a22',   // botas, correas
trapo: '#d8c9a8',   // vendas, el diente de la boca mellada
```

**Un campo de color**, `clothColor2` (rango 0–7, misma paleta `ropa`), para la faja.
Regla: si coincide con `clothColor`, se toma el siguiente de la lista. Sin esto la faja
desaparece dentro del jubón.

#### Cuerpo

- **Complexiones** (`body`, 3 valores, `COMPLEXIONES`): enjuto, recio y medio. Cambian los
  hombros y la cintura, no un par de unidades. El recio lleva barriga sobre la faja.
- **Hombros por complexión**: los brazos cuelgan a 13, 20 o 17 unidades del centro. Por eso
  `Look` trae su propio `rig` y los renderers lo leen a él, no el `RIG` base.
- **Faja** a la medida de la cintura de cada complexión, algo más ancha que el torso.
  **Escote** en pico, en `piel`.
- **Brazo**: manga hasta el codo, en una sola pieza. **Antebrazo**: grueso arriba y fino en la
  muñeca. **Puño**: un mazo cuadrado con la raya de los nudillos, en las dos manos, centrado en
  (0, −1) de la mano, donde montan las armas.
- **Piernas** abiertas 2,5 unidades en el tobillo, con el pantalón algo holgado en la rodilla.
  **Botas** con vuelta en la caña y suela, cada una apuntando hacia su lado (el peleón es
  frontal).

#### Cabeza

Origen en la base del cuello; el borde de arriba del torso cae en y = −3.

- **Calota común**: semicúpula de anchura ±17 en y = −26, con la cima en y = −42.
- **Cuatro mandíbulas** (`head`) bajo la calota: redonda, cuadrada, alargada (barbilla en
  y = −3) y de pómulos.
- **Cuello** corto y ancho, sin trazo abajo para que entre en el escote. **Orejas** detrás del
  cráneo.
- **Rasgos**: cejas en y = −28,5, ojos en (±7, −24), nariz (una línea) en −18,5 y boca en −13.
- **Barbas**: las que tapan la mandíbula (corta y cerrada) son algo más anchas que la más ancha
  de las cuatro, para cubrirlas todas. Las patillas van sin contorno y por dentro del borde de
  la cara: con trazo propio se leían como auriculares.
- **Pelos** (`hair`, 6 valores), en tres capas (`Peinado`): `detras` (se pinta antes que el
  cráneo: melena, coleta), `encima` (sobre la calota) y `bajoSombrero` (lo que asoma bajo un
  ala). Todos se dibujan contra la calota común.
- **La cresta llega a y = −55** de la cabeza, −125 del peleón. **El `viewBox` del retrato debe
  llegar a −128**: `viewBox="-58 -128 116 136"`.

#### Sombreros (preparado, sin campo todavía)

`Appearance` no tiene campo `hat`. La cabeza ya admite uno: `montarCabeza(rasgos, sombrero)`
pinta `bajoSombrero` en vez de `encima` y el sombrero al final. Un sombrero se dibuja contra la
calota con el ala en `LINEA_DEL_SOMBRERO` (y = −31) y dentro de ±21. La hoja `cabezas.svg`
prueba los seis pelos sobre las cuatro cabezas con dos sombreros de prueba (boina y ala), que
solo existen en la hoja.

Si se añade el campo, decidir antes si los peleones ya creados lo derivan del slug (§1.3) o se
quedan sin sombrero: derivarlo les cambia la cara.

#### Orden de pintado dentro de `head`

Cuello → pelo de detrás → orejas → cráneo → barba → nariz → marca en la piel → pelo de encima
(o lo que asoma bajo el sombrero) → cejas → ojos → boca → marca puesta → sombrero.

- El pelo de detrás va antes que el cráneo para enmarcar la cara en vez de taparla.
- La barba va antes que el pelo para que las patillas queden bajo la melena.
- El chirlo va antes que el pelo para que cada nacimiento de pelo lo corte; pintado después
  quedaba encima del flequillo.
- El parche va después de los ojos para taparlo, y no al revés.

#### Qué cambia más la cara

Al dibujarlo se ve que **las cejas y la boca pesan más que el pelo**: dos peleones con el mismo
cuerpo y distinta expresión se leen como personajes distintos, y son las rutas más baratas de
todo el lote (dos trazos cada una). Si hubiera que recortar el alcance, se recortan primero las
barbas, nunca las cejas.

---

## Parte 2 — Tokens de interfaz

Dirección elegida: la paleta del arte manda. La interfaz deja de ignorar `parts.ts`.

### 2.1 Dónde viven

Nuevo archivo `packages/shared/src/tokens.ts`, importado por la interfaz y por el arte. Las
paletas de personaje se quedan donde están, en `parts.ts`, pero los valores compartidos
(`TRAZO`, `GROSOR`, fondos) se mueven a `tokens.ts` y `parts.ts` los reexporta para no romper
imports.

Se exponen también como variables CSS en `:root`, para poder usarlos desde `styles.css`.

### 2.2 Los tokens

```
--tinta         #241f1c   texto, bordes y contornos. Es TRAZO. El mismo del arte
--tinta-suave   #4a3b2c   texto secundario
--papel         #ede3d0   fondo de página
--papel-claro   #f7efdc   superficie de tarjeta
--papel-hondo   #e2d3b6   superficie hundida: panel de retrato, barras, pie
--madera        #4a2f1c   barra superior. Es madera oscurecida
--oro           #e4c07a   texto sobre madera. Marca y enlaces de la barra
--linea         #8a7860   bordes suaves y separadores
--acento        #7a3a3a   acciones principales. Es PALETA.ropa[7]
--acento-hondo  #5c2b2b   acento en hover
--gana          #3f5c3f   victoria en el historial
--pierde        #7a3a3a   derrota en el historial
--borde         2px       grosor de borde de tarjetas y controles
--radio         3px       esquinas. Casi rectas, a juego con el trazo
```

Tipografía: **Alegreya** (700, 800) para títulos, cifras y botones; **Alegreya Sans**
(400, 500, 700) para el resto. Ambas con licencia SIL Open Font License: anotarlas en
`CREDITS.md` antes de usarlas. Se cargan solo esos cinco pesos.

Escala: 14 · 15 · 17 · 19 · 21 · 25 · 34 · 56 px. Espaciado en múltiplos de 4.

Las dos viven como variables en `:root` de `styles.css`, con nombre de papel y no de valor.
**No se escribe un tamaño ni un espaciado a mano**: si falta un paso, se añade aquí y allí.

```
--t-meta     14px   cifras pequeñas, fechas, cabeceras de tabla
--t-apoyo    15px   texto secundario (.apagado), ayudas, detalle
--t-cuerpo   17px   texto corrido y botones
--t-entrada  19px   la frase que abre una pantalla
--t-h3 21 · --t-h2 25 · --t-h1 34
--t-cartel   34-56  fluido: título de portada
--e-1 4 · --e-2 8 · --e-3 12 · --e-4 16 · --e-5 20 · --e-6 24 · --e-8 32 · --e-10 40 · --e-12 48 · --e-16 64
--letra-titulo (Alegreya) · --letra-cuerpo (Alegreya Sans)
```

Ritmo: un título lleva más aire encima que debajo (`* + h2` a `--e-10`, `* + h3` a
`--e-6`). Títulos con `text-wrap: balance`, párrafos con `pretty`, y cifras que se comparan
en columna con `tabular-nums`.

**El cartel de la pantalla.** Cada pantalla abre con una franja de madera a todo lo ancho bajo
la barra superior (`Pagina` con `cabecera`): el título en oro a `--t-cartel`, una bajada en
`--papel-hondo` y las tablas de la pared de la taberna del combate. Es la región que se lleva
el color fuerte; lo de debajo, papel y tinta, se queda callado. En el combate, el marcador se
pega al cartel (`pegada`) y los dos son la misma tabla. Fuera quedan, a propósito, la subida de
nivel (su cartel cuelga sobre el escenario) y las páginas de error.

Dos usos más del color con significado, y solo esos:

- **Ganó / Perdió** (`Resultado`): `--gana` y `--pierde`, siempre con la palabra y con un
  fondo tintado del mismo tono. Es el único verde y rojo de la interfaz.
- **Cartel** (`.cartel`): madera con letra de oro, el color de lo que se gana. Nombres en
  el escenario, el podio del ranking y el nivel al subir. No se usa para decorar.

### 2.3 El lienzo de combate, dentro de la paleta

Hecho. Los valores viven en `LIENZO` (`packages/shared/src/tokens.ts`):

| Qué                         | Antes      | Ahora                                        |
| --------------------------- | ---------- | -------------------------------------------- |
| Fondo del lienzo            | `0xf6f6f4` | `#e2d3b6` (`--papel-hondo`, no `--papel`)    |
| Línea de suelo              | `0xd8d4cc` | `#c9b894`                                    |
| Relleno de la barra de vida | `0x8fbf5a` | `#5f7245` (`PALETA.ropa[2]`, también `--vida`) |

El fondo no es `--papel` como pedía este documento: con el mismo color que la página, el
combate no se leía como superficie propia. Va en la superficie hundida.

Los textos del lienzo (carteles, números de daño, nombre de los bichos) van en Alegreya o
Alegreya Sans con la tinta de la paleta. No queda `Georgia` ni gris suelto.

### 2.4 Componentes

Había 24 `style={{` repartidos por 9 archivos porque no había dónde poner nada. Los seis de
base están en `ui.tsx`: `Boton` (principal y secundario) · `Tarjeta` · `Chips` (armas, mañas,
bichos) · `Estadistica` (etiqueta + cifra) · `Barra` (experiencia y vida) · `Pagina` (barra
superior + contenedor), más `TarjetaBoton` (una tarjeta entera que se pulsa).

Además, en uso desde 2026-11-24:

| Componente | Dónde | Para qué |
| --- | --- | --- |
| `Pagina` con `cabecera` (`ui.tsx`) | portada, ficha, arena, ranking, combate, legal | El cartel de madera con el título de la pantalla |
| `Escenario` (`Escenario.tsx`) | portada, subida de nivel, páginas vacías | El escenario del combate en pequeño, con un cartel por peleón |
| `NadieAqui` (`Escenario.tsx`) | 404, peleón o combate que no existe | En escena está **Nadie**, un peleón sacado del motor con ese nombre |
| `EscenaCombate` | reproductor y su espera | Marcador, lienzo, pie y controles, sin Pixi: la espera ocupa lo mismo |
| `CompartirEnlace` | combate, reclutamiento | Menú de compartir en el móvil, copiar en escritorio; siempre confirma |
| `Resultado`, `cuenta()`, `record()` | ficha, arena, ranking | «Ganó», «1 arma», «1 victoria · 3 derrotas»: nada de «1V 3D» |

Un enlace que parece botón es `<Link className="boton">`, nunca un `<Boton>` dentro de un
`<Link>`. Los `style={{}}` que quedan son anchos que salen de los datos (barras).

### 2.5 Responsive

Punto de corte único en **48rem**, y se mantiene: no hay otro ancho en `styles.css`. Aparte
solo están `(hover: hover)`, para que el hover no se quede pegado en táctil, y
`prefers-reduced-motion`.

**Ranking en móvil: lista densa de tres columnas, no tarjetas ni scroll horizontal.**

- Un solo panel con todas las filas dentro, no una tarjeta por peleón. Separador de 2px entre
  filas. Entran 13 filas en 390 px; con tarjetas entrarían 7, y un ranking se recorre buscando,
  no leyendo.
- Tres columnas: **puesto** (34 px, alineado a la derecha, en `--tinta-suave`), **nombre**
  (crece), y **nivel con récord apilados** y alineados a la derecha. Juntar nivel y récord en
  una columna es lo que permite pasar de cuatro columnas a tres sin perder ningún dato.
- **El nombre necesita `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.** El
  límite de nombre son 20 caracteres y a 390 px los largos empujan la columna de nivel fuera de
  la pantalla.
- **Barra fija al pie con el puesto propio**, fuera del área que hace scroll, con el mismo
  formato de tres columnas que las filas y la etiqueta «Tu peleón». Es un enlace a la ficha. El
  dato ya existe: `rank` viene en `GET /api/brutes/:slug`; hay que añadirlo a la respuesta del
  ranking o pedir la ficha propia aparte. Si el visitante no tiene peleón, la barra no se pinta.
- Cada fila entera es el enlace, no solo el nombre: a 390 px el objetivo táctil es la fila.
- Por encima de 48rem, la tabla de cuatro columnas de siempre, con la fila propia destacada al
  pie en un panel `--papel-hondo`.
- El puesto de la barra propia sale de la ficha (`GET /api/brutes/:slug`) y tiene que
  desempatar igual que la lista: nivel, victorias y, a igualdad, el más veterano
  (`puestoDe` en `apps/server/src/routes.ts`). Si no, la barra y la fila dicen puestos
  distintos.
- Los tres primeros llevan el puesto en `.cartel`.
- **Sin retratos en el ranking por ahora.** Requiere añadir `appearance` a la respuesta y son 50
  personajes SVG por pantalla. Se reevalúa cuando el resto esté hecho.
- La ficha en móvil: estadísticas en una fila de cinco tarjetas estrechas (hecho). **Sin
  hacer:** retrato pequeño junto al nombre y botón de pelea fijo abajo, fuera del área que
  hace scroll; hoy el retrato va grande dentro de la tarjeta y el botón en la tarjeta de
  acciones.

### 2.6 Modo oscuro

No se hace. Los tokens quedan preparados (todos los colores pasan por variable), pero un juego
de fondo de papel con trazo oscuro no tiene versión oscura evidente, y el arte del combate no la
tiene en absoluto. Si se pide más adelante, es un trabajo de arte, no de CSS.

---

## Parte 3 — Orden de trabajo

Estado a 2026-11-24:

1. ~~Piezas que faltan para los rangos actuales (§1.1).~~ Hecho, y luego el cuerpo y la
   cabeza rehechos enteros (§1.6).
2. ~~`tokens.ts` + variables CSS + alinear los tres colores del lienzo (§2.1, §2.3).~~ Hecho.
3. ~~Componentes base (§2.4) y aplicarlos pantalla por pantalla.~~ Hecho, más la escala de
   tipo y espaciado como tokens (§2.2).
4. ~~Ranking en móvil (§2.5).~~ Hecho, salvo los retratos (descartados por ahora).
5. ~~Semilla por campo y campos nuevos de `Appearance` (§1.2, §1.3).~~ Hecho.

Pendiente: la ficha en móvil con el botón de pelea fijo (§2.5), los sombreros (§1.6, ya
preparados en el dibujo pero sin campo en `Appearance`) y el modo oscuro, que sigue sin
hacerse a propósito (§2.6).

## Cuidado con esto

- **Los textos del e2e son contrato.** «Nombre del peleón», «Crear», «Ir al final», «Buscar
  pelea», «Elegir mejora», «Retrato del peleón», «Guarda este enlace», «Se acabó en N turnos»,
  «Ganó»/«Perdió» y la clase `.rejilla`. Si un rediseño cambia alguno, se actualiza el test en
  el mismo commit, nunca después.
- Cambiar arte y animaciones **no** sube `ENGINE_VERSION`. Ampliar los rangos de
  `rollAppearance` tampoco, porque la apariencia está guardada.
- Tras tocar el motor, volver a correr `pnpm seed`: los bots se quedan congelados.
