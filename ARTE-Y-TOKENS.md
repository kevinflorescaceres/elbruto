# ARTE-Y-TOKENS.md — variedad de peleones y tokens de interfaz

Responde a las preguntas abiertas de `docs/CONTEXTO-DISENO.md` y fija lo acordado. Manda sobre
`plan.md` §11 solo en lo que aquí se detalle; las restricciones de contenido original siguen
intactas.

---

## Parte 1 — Más variedad de peleones

El problema medido: de 17.280 apariencias que genera el motor, solo 3.840 se pueden dibujar.
Cinco de cada seis peleones son el clon visual de otro.

### 1.1 Primero, cerrar el hueco que ya existe

Antes de añadir nada nuevo, dibujar las piezas que faltan para los rangos actuales:

| Constante | Hoy | Debe tener | Qué falta                                       |
| --------- | --- | ---------- | ----------------------------------------------- |
| `TORSOS`  | 2   | **3**      | una complexión intermedia entre enjuto y recio  |
| `CABEZAS` | 2   | **4**      | una alargada y una ancha de pómulos altos       |
| `PELOS`   | 4   | **6**      | entradas con coleta, y calva con corona de pelo |

Con eso solo, las 17.280 apariencias pasan a ser todas distintas, sin tocar el motor, sin
migrar nada y sin afectar a los peleones ya creados. **Hacer esto primero y medir.**

### 1.2 Campos nuevos de `Appearance`

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
  `head`, en este orden de pintado: cráneo → cejas → ojos → boca → barba → pelo → marca.
  La marca va al final para que un parche tape el ojo y no al revés.
- `beard` usa el tinte `pelo`, así queda del mismo color que la cabeza sin trabajo extra.
- `mark`: el chirlo y la venda usan `oscuro` y `piel`; el parche, `oscuro`.
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

### 1.6 Rutas ya dibujadas — copiar tal cual

Todas están dibujadas y revisadas en el lienzo de diseño. Van en el sistema de coordenadas del
peleón (origen entre los pies, la altura crece hacia −y), así que entran directas en `parts.ts`.
Son rutas originales de este proyecto.

**Dos tintes nuevos** en la unión `Tinte`:

```ts
cuero: '#5b3a22',   // botas, correas
trapo: '#d8c9a8',   // vendas
```

**Un campo nuevo de color**, `clothColor2` (rango 0–7, misma paleta `ropa`), para la faja.
Regla: si coincide con `clothColor`, se toma el siguiente de la lista. Sin esto la faja
desaparece dentro del jubón.

#### Cabezas — `head`, 4 valores

```ts
const CABEZAS = [
  'M -20 -88 Q -20 -110 0 -110 Q 20 -110 20 -88 Q 20 -70 0 -70 Q -20 -70 -20 -88 Z',
  'M -19 -108 L 19 -108 Q 21 -108 21 -104 L 21 -80 Q 21 -70 11 -70 L -11 -70 Q -21 -70 -21 -80 L -21 -104 Q -21 -108 -19 -108 Z',
  'M -17 -90 Q -17 -112 0 -112 Q 17 -112 17 -90 Q 17 -68 0 -68 Q -17 -68 -17 -90 Z',
  'M -22 -96 Q -22 -110 0 -110 Q 22 -110 22 -96 Q 22 -86 14 -78 Q 7 -70 0 -70 Q -7 -70 -14 -78 Q -22 -86 -22 -96 Z',
]; // redonda · cuadrada · alargada · ancha de pómulos
```

#### Pelos — `hair`, 6 valores, tinte `pelo`

```ts
// rapado
'M -20 -94 Q -18 -112 0 -112 Q 18 -112 20 -94 Q 10 -104 0 -103 Q -10 -104 -20 -94 Z';
// greñas
'M -21 -88 Q -22 -113 0 -113 Q 22 -113 21 -88 Q 17 -97 13 -90 Q 9 -99 4 -91 Q -1 -100 -6 -91 Q -11 -99 -15 -90 Q -18 -96 -21 -88 Z';
// cresta (dos rutas)
'M -16 -100 Q -14 -108 0 -108 Q 14 -108 16 -100 Q 8 -104 0 -104 Q -8 -104 -16 -100 Z';
'M -5 -106 Q -9 -122 0 -125 Q 9 -122 5 -106 Q 0 -109 -5 -106 Z';
// melena
'M -20 -92 Q -22 -112 0 -112 Q 22 -112 20 -92 L 22 -66 Q 16 -64 15 -72 Q 14 -98 0 -98 Q -14 -98 -15 -72 Q -16 -64 -22 -66 Z';
// entradas con coleta (dos rutas)
'M -18 -98 Q -14 -110 0 -110 Q 14 -110 18 -98 Q 12 -104 6 -103 Q 8 -108 0 -108 Q -8 -108 -6 -103 Q -12 -104 -18 -98 Z';
'M 17 -101 Q 29 -99 27 -85 Q 24 -92 16 -95 Z';
// calvo con corona (dos rutas)
'M -20 -90 Q -21 -99 -17 -102 Q -16 -93 -12 -90 Z';
'M 20 -90 Q 21 -99 17 -102 Q 16 -93 12 -90 Z';
```

La cresta sube hasta y = −125. **El `viewBox` del retrato debe llegar a −128**, no a −116, o se
corta. En la ficha: `viewBox="-58 -128 116 136"`.

#### Cejas — `brow`, 4 valores, sin relleno, `stroke-width` 2.4

```ts
[
  'M -12 -95 L -5 -95',
  'M 12 -95 L 5 -95',
] // recta
[
  ('M -12 -97 L -5 -93', 'M 12 -97 L 5 -93')
] // caída
[
  ('M -12 -94 Q -8.5 -99 -5 -94', 'M 12 -94 Q 8.5 -99 5 -94')
] // arqueada
[('M -12 -95 L -9 -95 M -7 -96 L -5 -96', 'M 12 -95 L 5 -95')]; // partida
```

#### Bocas — `mouth`, 4 valores

```ts
[
  { d: 'M -6 -78 Q 0 -74 6 -78', trazo: 2.4 },
] // sonrisa
[
  { d: 'M -6 -78 Q 0 -75 6 -81', trazo: 2.4 }
] // torcida
[
  { d: 'M -7 -77 L 7 -77', trazo: 2.4 }
] // apretada
[
  ({ d: 'M -6 -79 L 6 -79 L 6 -74 L -6 -74 Z', fill: 'oscuro' }, // mellada
  { d: 'M -1 -79 L 2 -79 L 2 -76 L -1 -76 Z', fill: 'piel' })
];
```

#### Barbas — `beard`, 6 valores, tinte `pelo`

```ts
[]; // sin barba
('M -4 -76 L 4 -76 L 3 -66 Q 0 -63 -3 -66 Z'); // perilla
('M -9 -81 Q 0 -85 9 -81 Q 5 -76 0 -77 Q -5 -76 -9 -81 Z'); // bigote
('M -18 -93 L -13 -93 L -12 -76 L -17 -79 Z'); // patillas (dos rutas)
('M 18 -93 L 13 -93 L 12 -76 L 17 -79 Z');
('M -16 -85 Q -16 -66 0 -66 Q 16 -66 16 -85 Q 12 -74 0 -74 Q -12 -74 -16 -85 Z'); // corta
('M -18 -91 Q -19 -60 0 -58 Q 19 -60 18 -91 Q 12 -78 0 -79 Q -12 -78 -18 -91 Z'); // cerrada
```

#### Marcas — `mark`, 6 valores (0, 1 y 2 vacíos)

```ts
// chirlo
{ d: 'M 12 -100 L 7 -83', trazo: 2.6 }
// parche: correa + disco
{ d: 'M -21 -94 L 20 -91', trazo: 2.6 }
{ d: 'M -14 -94 a 6.5 6.5 0 1 0 0.1 0 Z', fill: 'oscuro' }
// venda
{ d: 'M -21 -101 L 21 -98 L 21 -91 L -21 -94 Z', fill: 'trapo' }
```

**El parche lleva un arco.** Es legal aquí, porque `scalePath` solo se aplica a las armas, pero
nunca debe copiarse a una ruta de arma: la función lanza una excepción a propósito.

#### Torsos — `body`, 3 valores, tinte `ropa`

```ts
'M -13 -40 Q -16 -55 -14 -66 Q -14 -72 -8 -72 L 8 -72 Q 14 -72 14 -66 Q 16 -55 13 -40 Z'; // enjuto
'M -16 -40 Q -19 -56 -17 -67 Q -17 -73 -9 -73 L 9 -73 Q 17 -73 17 -67 Q 19 -56 16 -40 Z'; // recio
'M -14 -40 Q -18 -54 -15 -66 Q -15 -72 -8 -72 L 8 -72 Q 15 -72 15 -66 Q 18 -54 14 -40 Z'; // medio
```

#### Detalle de cuerpo — siempre presente, no es variante

```ts
// faja, en clothColor2. Va en la parte baja del torso
{ d: 'M -14 -47 L 14 -47 L 13 -39 L -13 -39 Z', fill: 'ropa2' }
// escote en pico, tinte piel. Sin él la cabeza flota sobre un rectángulo
{ d: 'M -5 -72 L 0 -62 L 5 -72', fill: 'piel' }
// vuelta de bota, tinte cuero, sustituye al pie negro actual
{ d: 'M -13 -14 L -1 -14 L -1 -5 L -16 -5 Q -18 -5 -18 -8 Q -18 -14 -13 -14 Z', fill: 'cuero' }
{ d: 'M 1 -14 L 13 -14 Q 18 -14 18 -8 Q 18 -5 16 -5 L 1 -5 Z', fill: 'cuero' }
```

#### Orden de pintado dentro de `head`

Cráneo → **barba** → pelo → cejas → ojos → boca → marca.

La barba va **antes** que el pelo para que las patillas y la barba cerrada queden por debajo de
la melena, y la marca al final para que el parche tape el ojo y no al revés.

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

### 2.3 Cambios en el lienzo de combate

Tres valores del combate están fuera de paleta y hay que alinearlos:

| Qué                         | Hoy        | Debe ser                      |
| --------------------------- | ---------- | ----------------------------- |
| Fondo del lienzo            | `0xf6f6f4` | `0xede3d0` (`--papel`)        |
| Línea de suelo              | `0xd8d4cc` | `0xc9b894`                    |
| Relleno de la barra de vida | `0x8fbf5a` | `0x5f7245` (`PALETA.ropa[2]`) |

El verde actual es el único color saturado de todo el juego y se nota. El de `ropa` es el mismo
verde apagado que puede llevar puesto un peleón.

Los carteles del lienzo usan `Georgia`: cambiar a **Alegreya**, que ya se carga.

### 2.4 Componentes que faltan

Hoy hay 24 `style={{` repartidos por 9 archivos porque no hay dónde poner nada. Crear, con los
tokens:

`Boton` (principal y secundario) · `Tarjeta` · `Chip` (armas, mañas, bichos) ·
`Estadistica` (etiqueta + cifra) · `Barra` (experiencia y vida) · `Pagina` (barra superior +
contenedor). Objetivo: dejar `styles.css` como hoja de tokens y estilos base, sin clases ad hoc.

### 2.5 Responsive

No hay ninguna `@media` en el proyecto. Punto de corte único en **48rem**.

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
- **Sin retratos en el ranking por ahora.** Requiere añadir `appearance` a la respuesta y son 50
  personajes SVG por pantalla. Se reevalúa cuando el resto esté hecho.
- La ficha en móvil: retrato pequeño junto al nombre, estadísticas en una fila de cinco
  tarjetas estrechas, y el botón de pelea fijo abajo, fuera del área que hace scroll.

### 2.6 Modo oscuro

No se hace. Los tokens quedan preparados (todos los colores pasan por variable), pero un juego
de fondo de papel con trazo oscuro no tiene versión oscura evidente, y el arte del combate no la
tiene en absoluto. Si se pide más adelante, es un trabajo de arte, no de CSS.

---

## Parte 3 — Orden de trabajo

1. Piezas que faltan para los rangos actuales (§1.1). Medir con la hoja de contacto.
2. `tokens.ts` + variables CSS + alinear los tres colores del lienzo (§2.1, §2.3).
3. Componentes base (§2.4) y aplicarlos pantalla por pantalla, empezando por la ficha.
4. Ranking en móvil (§2.5).
5. Semilla por campo y campos nuevos de `Appearance` (§1.2, §1.3). Va al final porque toca el
   motor y la base, y conviene hacerlo con todo lo demás estable. Las rutas están en §1.6: no
   hace falta inventar ninguna.

Los tintes nuevos (`cuero`, `trapo`), el campo `clothColor2` y el detalle de cuerpo (faja,
escote, vuelta de bota) entran en el paso 1 junto con las piezas que faltan: no dependen de
campos nuevos de `Appearance` salvo `clothColor2`, que sí es un campo y sigue la regla de §1.3.

## Cuidado con esto

- **Los textos del e2e son contrato.** «Nombre del peleón», «Crear», «Ir al final», «Buscar
  pelea», «Elegir mejora», «Retrato del peleón», «Guarda este enlace», «Se acabó en N turnos»,
  «Ganó»/«Perdió» y la clase `.rejilla`. Si un rediseño cambia alguno, se actualiza el test en
  el mismo commit, nunca después.
- Cambiar arte y animaciones **no** sube `ENGINE_VERSION`. Ampliar los rangos de
  `rollAppearance` tampoco, porque la apariencia está guardada.
- Tras tocar el motor, volver a correr `pnpm seed`: los bots se quedan congelados.
