# CONTEXTO-DISENO.md — el repo de Camorra, para el trabajo de diseño

Extraído del código el 2026-09-18. Donde el código y los documentos no coinciden, aquí manda
el código; las diferencias van en la sección 8.

**Nombre del proyecto: Camorra.** Sigue pendiente de verificar contra el registro de marcas.

---

## 1. Mapa del proyecto

Monorepo pnpm. Estructura real hasta dos niveles:

```
apps/server/   Fastify + Prisma. En producción sirve también el frontend construido
apps/web/      Vite + React + PixiJS
packages/engine/  simulate(), PRNG, catálogo, reglas. Cero dependencias
packages/shared/  esquemas Zod de la API
docker/  e2e/  docs/
plan.md  combate.md  CLAUDE.md  CREDITS.md  Dockerfile  fly.toml  docker-compose.yml
```

### Versiones

|                         |         |
| ----------------------- | ------- |
| Node                    | 22.15.0 |
| React                   | 19.3.0  |
| React Router            | 8.4.0   |
| PixiJS                  | 8.21.0  |
| GSAP                    | 3.15.0  |
| TanStack Query          | 5.103.1 |
| Fastify                 | 5.12.5  |
| Prisma / @prisma/client | 7.10.0  |
| Zod                     | 4.6.5   |
| Vite                    | 7.3.6   |
| TypeScript              | 5.9.3   |

### Comandos de uso diario

| Comando                                | Qué hace                                                    |
| -------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                             | server en :3000 y web en :5173                              |
| `pnpm test`                            | Vitest sobre `packages/*`, `apps/server` y `apps/web`       |
| `pnpm e2e`                             | Playwright contra el servidor de producción                 |
| `pnpm lint` · `typecheck` · `format`   | calidad                                                     |
| `pnpm balance`                         | 10.000 combates; falla si el equilibrio se sale de rango    |
| `pnpm --filter @camorra/web ritmo`     | mide segundos por acción de la animación                    |
| `pnpm --filter @camorra/web art <dir>` | hojas de contacto del arte en SVG                           |
| `pnpm seed`                            | 240 bots, 8 por nivel. Correctivo: actualiza los existentes |
| `pnpm admin`                           | `list-reports` / `rename <slug> <nombre>` / `delete <slug>` |
| `pnpm db:migrate` · `db:test:prepare`  | migraciones                                                 |

### Fase del plan por parte

| Parte                         | Estado                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| Monorepo, CI, Docker (fase 0) | completa                                                            |
| Motor de combate (fase 1)     | completa, y después reescrito según `combate.md`                    |
| Backend (fase 2)              | completa                                                            |
| Frontend funcional (fase 3)   | completa. **El diseño sigue en el "mínimo funcional" de esta fase** |
| Render del combate (fase 4)   | completa                                                            |
| Arte vectorial (fase 5)       | completa en lo estructural; poca variedad de piezas                 |
| Pulido y despliegue (fase 6)  | completa salvo el despliegue en sí                                  |
| Ranking (fase futura)         | hecho                                                               |
| Pupilos (fase futura)         | hecho                                                               |
| Torneos diarios, sonido       | (no existe)                                                         |

---

## 2. Apariencia del personaje

### Definición

`packages/engine/src/types.ts`

```ts
export interface Appearance {
  body: number;
  head: number;
  hair: number;
  skinColor: number;
  hairColor: number;
  clothColor: number;
}
```

### Rangos exactos

Generados en `rollAppearance()`, `packages/engine/src/brute.ts`:

| Campo        | Rango | Nº de valores |
| ------------ | ----- | ------------- |
| `body`       | 0–2   | 3             |
| `head`       | 0–3   | 4             |
| `hair`       | 0–5   | 6             |
| `skinColor`  | 0–4   | 5             |
| `hairColor`  | 0–5   | 6             |
| `clothColor` | 0–7   | 8             |

### Cómo se deriva del nombre

`slugify(name)` normaliza (sin acentos, minúsculas, todo lo demás a `-`) →
`bruteSeed(slug) = hashString(slug)`, FNV-1a de 32 bits → `mulberry32(seed)`.

`createBrute()` consume el PRNG **en este orden**: `rollStats()` (4 tiradas), `rollAppearance()`
(6 tiradas), mejora inicial. **El orden importa:** meter una tirada antes de `rollAppearance`
cambia la cara de todos los peleones existentes.

**Se guarda en la base** (`Brute.appearance`, columna `Json`); no se recalcula al leer, así que
cambiar los rangos no altera a quien ya existe.

### Inventario de piezas dibujadas

`apps/web/src/art/parts.ts`

| Parte             | Variantes                        | Campo que la elige | Constante            |
| ----------------- | -------------------------------- | ------------------ | -------------------- |
| Torso             | **2**                            | `appearance.body`  | `TORSOS`             |
| Cabeza            | **2**                            | `appearance.head`  | `CABEZAS`            |
| Pelo              | **4**                            | `appearance.hair`  | `PELOS`              |
| Pierna            | 1, sin variantes                 | —                  | `PIERNA`             |
| Brazo / antebrazo | 1 cada uno, sin variantes        | —                  | `BRAZO`, `ANTEBRAZO` |
| Puño              | 1                                | —                  | `PUNO`               |
| Arma en mano      | 5, una por categoría             | categoría del arma | `ARMAS`              |
| Mascota           | 3 (`chucho`, `mastin`, `jabali`) | id de la mascota   | `MASCOTAS`           |

### Valores sin dibujo propio — **el número que interesa**

`lookFrom()` usa `pickFrom(lista, i)`, que hace `lista[i % lista.length]`. Los valores que
sobran caen sobre una pieza ya usada:

| Campo        | Valores que genera | Dibujos | **Sin dibujo propio**                              |
| ------------ | ------------------ | ------- | -------------------------------------------------- |
| `body`       | 3                  | 2       | **1** (el valor 2 reusa el torso 0)                |
| `head`       | 4                  | 2       | **2** (los valores 2 y 3 reusan las cabezas 0 y 1) |
| `hair`       | 6                  | 4       | **2** (los valores 4 y 5 reusan los pelos 0 y 1)   |
| `skinColor`  | 5                  | 5       | 0                                                  |
| `hairColor`  | 6                  | 6       | 0                                                  |
| `clothColor` | 8                  | 8       | 0                                                  |

- Combinaciones distintas de `Appearance` que el motor genera: **17.280**
- Aspectos visualmente distintos que se pueden dibujar hoy: **3.840**
- **13.440 combinaciones caen sobre un aspecto ya usado.** Cinco de cada seis peleones son,
  visualmente, el clon de otro.

### Paletas completas

```
piel   #f2d3b3  #e0b088  #c68a5e  #9c6440  #6f4529          (5)
pelo   #2b2118  #5b3a22  #9c6b35  #c9a227  #8a8a8a  #b04a2a  (6)
ropa   #8a5a3c  #41627f  #5f7245  #8a4a5a  #554a7a  #7a6a3a  #35696a  #7a3a3a  (8)

metal     #8c8c94     madera    #8a6a44
oscuro    #241f1c     pantalon  #3f3833
```

Trazo: `TRAZO = '#241f1c'`, `GROSOR = 3`. Fondo del lienzo de combate: `0xf6f6f4`.
Línea de suelo: `0xd8d4cc`. Barra de vida (relleno): `0x8fbf5a`.

**La interfaz no usa ninguno de estos colores.** Ver sección 5.

### El rig

`RIG` en `parts.ts`. Cada parte es un contenedor colocado en su articulación; girarlo gira
todo lo que cuelga.

| Parte          | Cuelga de  | Coordenada   |
| -------------- | ---------- | ------------ |
| `hips`         | — (raíz)   | `[0, -42]`   |
| `legBack`      | `hips`     | `[-6, 0]`    |
| `legFront`     | `hips`     | `[6, 0]`     |
| `torso`        | `hips`     | `[0, 0]`     |
| `armBack`      | `torso`    | `[-15, -25]` |
| `forearmBack`  | `armBack`  | `[0, 15]`    |
| `head`         | `torso`    | `[0, -28]`   |
| `armFront`     | `torso`    | `[15, -25]`  |
| `forearmFront` | `armFront` | `[0, 15]`    |

El arma cuelga de `forearmFront` en `[0, 16]`, con rotación −0,35 rad (−20° en el SVG).

`Z_ORDER = ['legBack', 'armBack', 'legFront', 'torso', 'head', 'armFront']`

**Partes del rig fuera de `Z_ORDER`:** `hips`, `forearmBack`, `forearmFront`. La función
`depth()` de `pixiRig.ts` les asigna el índice de `torso`. `hips` no dibuja nada propio; los
antebrazos heredan así la profundidad de su brazo.

### Coordenadas y tamaño

Origen del personaje en los pies, y crece hacia **−y**. El SVG de la ficha usa
`viewBox="-58 -116 116 124"`.

| Referencia                       | y    |
| -------------------------------- | ---- |
| Pies (suelo)                     | −8   |
| Caderas                          | −42  |
| Hombros                          | −67  |
| Base de la cabeza                | −70  |
| Coronilla                        | −108 |
| Punta del pelo más alto (cresta) | −124 |

Alto: **100 unidades** de pies a coronilla, **116** contando la cresta. Ancho: unas **42
unidades** (cabeza ø ~42, brazos a ±20). Proporción cabezona deliberada: la cabeza es el 38%
de la altura.

---

## 3. Animaciones

`apps/web/src/art/poses.ts`. Son tablas de keyframes, no código imperativo: cada frame lleva
`t` de 0 a 1 y las partes que cambian, con `rot` en radianes y `x`/`y` en unidades del rig.
**Los keyframes son acumulativos:** cada uno solo lista lo que cambia.

| Animación          | Frames | Bucle | Partes que mueve                                        |
| ------------------ | ------ | ----- | ------------------------------------------------------- |
| `idle`             | 3      | sí    | head, hips, torso                                       |
| `walk`             | 5      | sí    | armBack, armFront, hips, legBack, legFront              |
| `attackRapida`     | 4      | no    | armFront, forearmFront, hips, torso                     |
| `attackPesada`     | 4      | no    | armFront, forearmFront, head, hips, torso               |
| `attackLarga`      | 4      | no    | armFront, forearmFront, hips, legFront, torso           |
| `attackArrojadiza` | 4      | no    | armFront, forearmFront, hips, torso                     |
| `hit`              | 3      | no    | armBack, armFront, head, hips, torso                    |
| `evade`            | 3      | no    | hips, legBack, legFront, torso                          |
| `block`            | 3      | no    | armFront, forearmFront, hips, torso                     |
| `throw`            | 4      | no    | armFront, forearmFront, hips, torso                     |
| `death`            | 3      | no    | armBack, armFront, head, hips, legBack, legFront, torso |
| `victory`          | 5      | no    | armBack, armFront, hips, torso                          |

**Ninguna animación tiene duración propia.** El reproductor estira los keyframes a lo que dure
el hueco del evento dentro del turno. Ver sección 9.

### Cómo se eligen desde el combate

`apps/web/src/fightScene.ts` traduce cada evento del motor a movimientos:

| Evento        | Pose del rig             | Otros movimientos                                                 |
| ------------- | ------------------------ | ----------------------------------------------------------------- |
| `start`       | —                        | `announce` (cartel de apertura, insertado tras el último `spawn`) |
| `spawn`       | —                        | `appear`                                                          |
| `turn`        | —                        | `pulse`                                                           |
| `move`        | `walk`                   | `approach`                                                        |
| `attack`      | según categoría del arma | `lunge`                                                           |
| `counter`     | según arma en mano       | `lunge`                                                           |
| `hit`         | `hit`                    | —                                                                 |
| `evade`       | `evade`                  | —                                                                 |
| `block`       | `block`                  | `flash`                                                           |
| `damage`      | —                        | `hp`, `float`, `flash`                                            |
| `heal`        | —                        | `hp`, `float`, `flash`                                            |
| `drawWeapon`  | —                        | `weapon`                                                          |
| `throwWeapon` | `throw`                  | `projectile`, `weapon`                                            |
| `disarm`      | —                        | `toss`, `weapon`                                                  |
| `skill`       | —                        | `ring`, `flash`                                                   |
| `death`       | `death`                  | `fall`                                                            |
| `end`         | `victory`                | `announce`                                                        |

Categoría de arma → animación: `pesada`→`attackPesada`, `larga`→`attackLarga`,
`arrojadiza`→`attackArrojadiza`, todo lo demás y las mascotas→`attackRapida`.

**Eventos sin animación asignada: ninguno.** Los 17 producen al menos un movimiento, y hay un
test que lo comprueba. Ahora bien, **ocho de ellos no mueven el rig**: `spawn`, `turn`,
`damage`, `heal`, `drawWeapon`, `disarm`, `skill` y `start` solo producen efectos (destellos,
números, anillos). Ahí hay hueco para poses nuevas sin tocar el motor.

Las mascotas **no tienen rig**: se dibujan de una pieza y reciben un gesto sustituto
(`playFallback` en `timeline.ts`).

---

## 4. Motor de combate

`ENGINE_VERSION = 3`. Los combates guardados se reproducen desde su log, no se resimulan.

### Estadísticas

Cuatro: `endurance`, `strength`, `agility`, `speed`. Al crear: 12 puntos, mínimo 2 en cada una.

Rangos observados sobre 3.000 peleones generados:

|             | Nivel 1                | Nivel 10                 |
| ----------- | ---------------------- | ------------------------ |
| `endurance` | 2–6 (media 3,0)        | 2–20 (media 7,0)         |
| `strength`  | 2–6 (media 3,0)        | 2–19 (media 7,1)         |
| `agility`   | 2–6 (media 3,0)        | 2–21 (media 7,0)         |
| `speed`     | 2–6 (media 3,0)        | 2–19 (media 7,0)         |
| **vida**    | **63–87 (media 68,9)** | **77–185 (media 107,2)** |

Qué controla cada una: fuerza → daño; agilidad → esquiva, combo y daño de arrojadizas;
velocidad → intervalo entre acciones; resistencia → solo vida.

### Fórmulas vigentes, copiadas del código

```
vida      floor(50 + endurance*6 + level*1.5)
intervalo max(1, round(weapon.interval * 100 / (10 + speed)))   con ±18% de azar al aplicarlo
esquiva   clamp(22 + defender.agility*2 - weapon.accuracyBonus, 5, 36)     [%]
combo     clamp(weapon.comboRate + attacker.agility*2, 0, 45)              [%]
daño      weapon.damage + floor(aporte * weapon.strengthScale / 100)
          aporte = strength, salvo arrojadiza: agility*0.7 + strength*0.3
          luego ±20%, luego se resta armor (0 si el arma es pesada), mínimo 1
```

Constantes: `MAX_TURNS 500` · `MAX_COMBO_HITS 3` · `MAX_COMBO_CHANCE 45` ·
`COMBO_FALLOFF 0.7` (del impacto **anterior**, no de la base) · `COUNTER_LARGA 25` ·
`DODGE_BASE 22` · `JITTER 18`.

Orden de resolución: esquiva → (si esquiva, posible contraataque) → bloqueo → daño → combo.

Pesos de acción en el turno: atacar 60, sacar arma 12, lanzar 12, habilidad activa 18.
Objetivo: luchador rival peso 5, cada mascota viva peso 1.

### Catálogo de armas

`precisión` es `accuracyBonus`: se **resta** de la probabilidad de esquiva del defensor.

| id            | nombre visible      | categoría  | daño | intervalo | precisión | combo | escala fza | alcance | arrojadiza |
| ------------- | ------------------- | ---------- | ---- | --------- | --------- | ----- | ---------- | ------- | ---------- |
| `punos`       | Puños               | rapida     | 3    | 66        | 4         | 12    | 60         | 1       | no         |
| `chaira`      | Chaira              | rapida     | 6    | 50        | 5         | 19    | 45         | 1       | no         |
| `puntilla`    | Puntilla            | rapida     | 7    | 56        | 4         | 16    | 50         | 1       | no         |
| `jifero`      | Jifero              | media      | 9    | 76        | 4         | 12    | 75         | 1       | no         |
| `porra`       | Porra de Corchete   | media      | 10   | 84        | 3         | 8     | 85         | 2       | no         |
| `verduguillo` | Verduguillo         | larga      | 10   | 88        | 4         | 7     | 80         | 3       | no         |
| `chuzo`       | Chuzo de Sereno     | larga      | 13   | 102       | 1         | 4     | 95         | 4       | no         |
| `banqueta`    | Banqueta de Taberna | pesada     | 18   | 132       | −3        | 0     | 110        | 2       | no         |
| `tranca`      | Tranca de Portón    | pesada     | 22   | 150       | −6        | 0     | 130        | 2       | no         |
| `cascote`     | Cascote             | arrojadiza | 8    | 64        | 3         | 0     | 70         | 3       | sí         |
| `botija`      | Botija de Vino      | arrojadiza | 10   | 76        | 1         | 0     | 70         | 3       | sí         |

`punos` no se ofrece al subir de nivel: es el arma por defecto.

### Catálogo de habilidades

| id                | nombre visible  | tipo   | efecto                                  |
| ----------------- | --------------- | ------ | --------------------------------------- |
| `cuero-curtido`   | Cuero Curtido   | pasiva | +16 de vida máxima                      |
| `callo-viejo`     | Callo Viejo     | pasiva | +2 de armadura (resta al daño recibido) |
| `pies-ligeros`    | Pies Ligeros    | pasiva | +3 de agilidad                          |
| `brazo-de-fragua` | Brazo de Fragua | pasiva | +3 de fuerza                            |
| `resuello`        | Resuello        | pasiva | +3 de velocidad                         |
| `mano-zurda`      | Mano Zurda      | pasiva | 15% de bloqueo                          |
| `revire`          | Revire          | pasiva | 20% de contraataque tras esquivar       |
| `trago-largo`     | Trago Largo     | activa | cura el 40% de la vida máxima, una vez  |
| `zurriagazo`      | Zurriagazo      | activa | un golpe con daño ×2, una vez           |
| `desjarrete`      | Desjarrete      | activa | desarma al rival, una vez               |

### Catálogo de mascotas

| id       | nombre visible | vida | daño | precisión | intervalo | agilidad | **coste en resistencia** |
| -------- | -------------- | ---- | ---- | --------- | --------- | -------- | ------------------------ |
| `chucho` | Chucho         | 26   | 5    | 6         | 80        | 5        | −2                       |
| `mastin` | Mastín         | 46   | 9    | 2         | 105       | 2        | −4                       |
| `jabali` | Jabalí         | 72   | 15   | −2        | 130       | 0        | −8                       |

El coste se descuenta de la resistencia del dueño, con suelo en 0, antes de calcular su vida.

### Progresión

- XP: victoria +2, derrota +1. **Solo gana XP quien ataca**; el récord se apunta a los dos.
- Umbral: `level * 5`. Nivel 1 → 5 XP. Nivel 10 → 50 XP.
- Dos opciones al subir. **La primera es siempre de estadística**: +3 a una, o +2 y +1 entre dos.
- La segunda se sortea: arma 35%, habilidad 35%, mascota 10%, estadística 20%. A partir de la
  cuarta arma, el peso de "arma" baja a 10%.
- No se ofrece nada que ya se tenga. Con una elección pendiente no se puede pelear.
- Peleas diarias: 6, **más 1 por cada pupilo reclutado, hasta +6**. Reinicio a medianoche en
  `GAME_TIMEZONE`.
- Oponentes: 6 luchadores de nivel ±1, al azar, excluyendo los propios.

### Último resultado de `pnpm balance`

10.000 combates, niveles 1-30. Turnos medios 24,2. Tope de 500 turnos: 0,00%.
Sesgo de iniciativa: lado A 50,6%.

Victorias por elemento, de mayor a menor: **Mano Zurda 53,2%** … **Cascote 45,6%**.
Todo dentro de [40, 60]. Por categoría de arma, cara a cara con ambos armados:
media 53,2%, pesada 50,8%, arrojadiza 50,6%, larga 49,2%, rápida 46,1%.

Objetivos de sensación (`combate.md` §3), todos en rango:

|                         | Nivel 1 | Nivel 10 |
| ----------------------- | ------- | -------- |
| impactos por combate    | 21,1    | 17,0     |
| acciones por combate    | 23,8    | 20,9     |
| daño medio por impacto  | 5,6     | 11,5     |
| acciones con combo      | 12,0%   | 14,0%    |
| ataques que no conectan | 25,5%   | 34,6%    |
| racha máxima seguida    | 2,0     | 2,2      |

---

## 5. Interfaz actual

### Rutas

| Ruta                | Archivo             | Qué muestra                                                       |
| ------------------- | ------------------- | ----------------------------------------------------------------- |
| `/`                 | `pages/Home.tsx`    | Crear peleón, lista de "mis peleones", enlace al ranking          |
| `/reclutar/:slug`   | `pages/Home.tsx`    | La portada, más un cartel de quién te recluta                     |
| `/b/:slug`          | `pages/Brute.tsx`   | Ficha: retrato, stats, equipo, reclutamiento, historial, denuncia |
| `/b/:slug/arena`    | `pages/Arena.tsx`   | Seis rivales en tarjetas                                          |
| `/b/:slug/level-up` | `pages/LevelUp.tsx` | Dos opciones de mejora                                            |
| `/fight/:id`        | `pages/Fight.tsx`   | Reproductor PixiJS + log de texto plegado                         |
| `/claim/:token`     | `pages/Claim.tsx`   | Recuperar peleón; sin interfaz propia, solo estados               |
| `/ranking`          | `pages/Ranking.tsx` | Tabla de los mejores                                              |
| `/legal`            | `pages/Legal.tsx`   | Condiciones y privacidad                                          |
| `*`                 | `main.tsx` (inline) | 404                                                               |

### Estado de diseño por pantalla

**Todas siguen en el "mínimo funcional" de la fase 3.** Ninguna tiene diseño propio.
Las únicas dos cosas con identidad visual son el **lienzo de combate** y la **imagen de Open
Graph** (`apps/web/public/og.png`), y ambas usan la paleta del arte, que la interfaz ignora.

### Dónde viven los estilos

- **Un único archivo**: `apps/web/src/styles.css`, 130 líneas.
- **No hay archivo de tokens.** (no existe)
- **No hay CSS modules, ni utilidades, ni framework.** (no existe)
- Clases disponibles: `.apagado`, `.tarjeta`, `.rejilla`, `.fila`, `.error`, `.barra`, `.log`.
- Variables CSS declaradas en `:root`: `--linea: #d4d4d4`, `--apagado: #6b6b6b`,
  `--fondo-suave: #f6f6f4`. Nada más.
- Tipografía: `system-ui, sans-serif` en `body`. `Georgia, serif` solo dentro del lienzo de
  combate (carteles) y en la imagen de compartir.
- **Estilos en línea repartidos por 9 archivos** (24 apariciones de `style={{`). Esa es la vía
  de escape que se ha usado para todo lo que la hoja no cubre.

### Componentes reutilizados

| Componente      | Archivo             | Usado en                    |
| --------------- | ------------------- | --------------------------- |
| `Fighter`       | `art/Fighter.tsx`   | ficha y arena (2 pantallas) |
| `FightPlayer`   | `FightPlayer.tsx`   | solo `/fight/:id`           |
| `FightLog`      | `FightLog.tsx`      | solo `/fight/:id`           |
| `Cuenta`        | `Cuenta.tsx`        | solo la ficha               |
| `ErrorBoundary` | `ErrorBoundary.tsx` | envuelve toda la app        |

No hay componentes de botón, tarjeta, tabla ni layout: se repiten las clases a mano.

### Responsive

- **No hay ni una `@media` en todo el proyecto. Cero breakpoints.**
- Lo único adaptable es `.rejilla`: `repeat(auto-fill, minmax(15rem, 1fr))`.
- `main` tiene `max-width: 52rem` y `padding: 1.5rem 1rem 4rem`.
- El lienzo de combate se escala con `width: 100%; height: auto` sobre un
  `aspect-ratio: 900 / 420`.
- El resto se apaña por el flujo natural del navegador. **La tabla del ranking no tiene ningún
  tratamiento para pantallas estrechas.**

### El ranking

`<table>` HTML plana dentro de un `.tarjeta`, sin scroll horizontal ni contenedor propio.
Columnas: **`#`**, **`Peleón`**, **`Nivel`**, **`Récord`**. Los peleones propios se marcan con
`fontWeight: 'bold'` en línea y con el sufijo " · tuyo". Se piden 50 filas por defecto.

---

## 6. Datos que llegan a cada pantalla

Todo se valida con Zod en los dos lados (`packages/shared/src/api.ts`).

| Pantalla   | Endpoint                          | Campos                                                                                                                                                                                                                                                                                                                                 |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ficha      | `GET /api/brutes/:slug`           | `name slug level xp xpToNextLevel maxHp` · `endurance strength agility speed` · `weapons[] skills[] pets[]` (**ids**, no objetos) · `appearance{body,head,hair,skinColor,hairColor,clothColor}` · `wins losses isBot` · `fightsLeftToday pendingLevelUp nextResetAt` · `rank` (número o `null`) · `pupils` · `master{name,slug}\|null` |
| Arena      | `GET /api/brutes/:slug/opponents` | `{ opponents: [mismos campos que la ficha] }`                                                                                                                                                                                                                                                                                          |
| Ranking    | `GET /api/ranking`                | `brutes[]: rank name slug level wins losses` · `total`. **No trae `appearance`**                                                                                                                                                                                                                                                       |
| Repetición | `GET /api/fights/:id`             | `id createdAt seed engineVersion winner('A'\|'B') snapshotA snapshotB log[]`. Los snapshots son la ficha completa congelada al pelear                                                                                                                                                                                                  |
| Historial  | `GET /api/brutes/:slug/fights`    | `fights[]: id createdAt opponent{name,slug,level} won` · `nextCursor`                                                                                                                                                                                                                                                                  |

**Lo que las pantallas muestran y no viene de la API:**

- Los **nombres visibles** de armas, mañas y bichos. La API manda ids; la ficha y la pantalla de
  mejora llaman a `getWeapon()`, `getSkill()` y `getPet()` del motor para traducirlos.
- El arma del retrato: se elige en cliente la de **mayor alcance** de las que lleva.
- El enlace de reclutamiento: `window.location.origin + '/reclutar/' + slug`.
- La tarjeta de la arena muestra el **recuento** de armas/mañas/bichos, no sus nombres.
- El ranking **no puede mostrar retratos hoy** sin una petición extra por peleón.

## 7. Textos

**No hay sistema de traducción** (no existe): todo en español, escrito directamente en el JSX.
Los textos del combate viven aparte, en `apps/web/src/fightLines.ts`.

| Pantalla     | Textos                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portada      | «Camorra» · «Pon un nombre y tendrás un peleón. Lo demás lo deciden él y la mala suerte.» · «Nuevo peleón» · «Guarda este enlace» · «Es la única forma de recuperar tu peleón en otro navegador. No se vuelve a enseñar.» · «Mis peleones» · «Ver quién manda en la calle →» · «Todavía no tienes ninguno.» · campo «Nombre del peleón», ejemplo «Chirlo de la Cava»                                                                    |
| Ficha        | «Vida» · «Armas» · «Mañas» · «Bichos» · «Te quedan N peleas hoy.» · «Por hoy se acabó. Vuelven en …» · «Buscar pelea» · «Tienes una mejora sin elegir. Hasta que la elijas no puedes pelear.» · «Elegir mejora» · «Comprobando...» · «Recluta gente» · «Cada peleón que entre con tu enlace te da una pelea diaria más, hasta seis. A quien recluta no le cuesta nada.» · «Peleas» · «Todavía no ha peleado.» · «Denunciar este nombre» |
| Arena        | «Elige rival» · «Gente de tu nivel, más o menos. Elige y ya no hay vuelta atrás.» · «Aquí no pintas nada» · «Solo el dueño de un peleón puede buscarle pelea.»                                                                                                                                                                                                                                                                          |
| Mejora       | «Nivel N» · «Dos caminos. Uno se queda por el camino.» · «Arma {categoría} · N de daño · intervalo N» · «Maña de un solo uso por pelea» / «Maña permanente» · «Bicho · N de vida · N de daño» · «Mejora de aptitudes»                                                                                                                                                                                                                   |
| Combate      | «Montando la escena...» · «Preparados...» · «Pausa»/«Seguir» · «Ir al final» · «Repetir» · «Ver el combate en texto» · «Copiar enlace». Carteles en el lienzo: «¡Camorra!» y «Gana {nombre}»                                                                                                                                                                                                                                            |
| Ranking      | «Los más temidos» · «N peleones en la calle. Los bots de la casa no cuentan.» · «Todavía no hay nadie. Sé el primero.» · columnas «#», «Peleón», «Nivel», «Récord»                                                                                                                                                                                                                                                                      |
| Recuperación | «Recuperando tu peleón...» · «Ese enlace no vale» · «O está mal copiado, o el peleón ya no existe.»                                                                                                                                                                                                                                                                                                                                     |
| Error global | «Se ha liado» · «Algo ha fallado por nuestra parte. Si vuelve a pasar, cuéntanoslo y lo miramos.» · «Recargar» · «Volver al principio» · «Detalle técnico»                                                                                                                                                                                                                                                                              |

Log de combate, una línea por evento: «X ataca a Y con Z.» · «X se aparta a tiempo.» ·
«X para el golpe.» · «X responde en el acto.» · «X encaja N y se queda en M.» · «X echa mano de
Z.» · «X le tira Z a Y.» · «X desarma a Y: Z al suelo.» · «X se desploma.» · «Se acabó en N turnos.»

## 8. Discrepancias y deuda

### El encargo contra el repo

- El encargo cita `docs/COMBATE.md` y `PLAN.md`. **Los archivos reales son `combate.md` y
  `plan.md`, en la raíz.** `docs/` no existía; este documento la crea.

### `plan.md` contra el código

- **§8 dice que `GET /me` crea el guardián si no existe. El código ya no lo hace.** Crear
  identidad en una lectura provocaba una carrera: React monta dos veces, salen dos `GET /me`
  sin cookie, se crean dos guardianes y el navegador guarda una sola cookie. La identidad se
  crea ahora en la primera escritura. Está explicado en `routes.ts`.
- §5 describe `Brute` sin `masterId`. El campo existe desde que se implementaron los pupilos.
- «Fases futuras» listaba Ranking y Pupilos; ambas están hechas y marcadas en el documento.

### `combate.md` contra el código

- **§4.6 fija la esquiva en `clamp(10 + agility*2 - accuracyBonus, 5, 40)`. El código usa base
  **22** y techo **36**.** Con la base 10 los ataques fallados se quedaban en 12,6% y el
  objetivo de §3 es 20-35%; con techo 40, a nivel 10 se iban a 35,6%. Ambas desviaciones están
  medidas y comentadas en `simulate.ts`.
- **§4.3 da la fórmula del intervalo sin azar. El código añade un ±18%** (`JITTER`). Sin él,
  dos luchadores iguales alternan en lockstep y nunca encadenan dos acciones, que es justo lo
  que §1.2 dice que no debe pasar.
- §5 pide que el motor no conozca milisegundos y que el cliente convierta con un `TIME_SCALE`
  único. Cumplido: `TIME_SCALE = 1.5` en `fightScene.ts`.
- §6 pide medir que ninguna categoría de arma supere el 60% a nivel 1. **Medido como "tener
  arma contra no tenerla" da 86% para todas**, porque eso mide que un arma vale más que una
  maña, no que una categoría domine. El test y el script miden **cara a cara con ambos
  armados**, que es lo que el criterio quiere decir.

### A medio hacer

- `apps/web/src/pages/Legal.tsx:53` — `TODO: poner una dirección real antes de desplegar`.
  El texto visible dice `CORREO_DE_CONTACTO_PENDIENTE`.
- Tres tests de metadatos usan `it.runIf(construido)`: **se saltan si no existe
  `apps/web/dist`**. No están rotos, pero pasan en silencio sin avisar.
- Tres marcadores `ponytail:` de deuda consciente: `ORDER BY random()` al buscar oponentes
  (`routes.ts:296`), el puesto del ranking contado en cada visita (`routes.ts:57`), y la cuenta
  atrás que se desvía una hora el día del cambio de horario (`db.ts:33`).

### Decisiones tomadas que no están en ningún documento

- **El rate limit vive en memoria de cada máquina.** Con escalado a cero en Fly se reinicia en
  cada arranque en frío, y con varias máquinas el límite es por máquina.
- **Los paquetes del workspace se publican como TypeScript fuente** (`exports: "./src/index.ts"`),
  sin paso de build. Vite y `tsx` los consumen directos.
- **El seed es correctivo**: al cambiar las reglas del motor hay que volver a correrlo o los
  bots quedan congelados. Ya pasó una vez: tenían la mitad de estadísticas.
- **`ENGINE_VERSION` sube cuando cambian las reglas**, y los combates viejos se reproducen desde
  su log guardado. Cambiar animaciones **no** obliga a subirla: son presentación, no reglas.
- El arte se revisa con hojas de contacto SVG (`pnpm --filter @camorra/web art`), porque no hay
  forma de mirarlo sin navegador. Es paso obligado antes de dar por buena una ruta nueva.

---

## 9. Restricciones para el trabajo de diseño

**Del rig y el arte** — romper esto rompe el reproductor:

- Los nombres de parte de `PartName` son contrato: `hips`, `torso`, `head`, `armBack`,
  `forearmBack`, `armFront`, `forearmFront`, `legBack`, `legFront`. Las animaciones de
  `poses.ts` los referencian, y hay un test que falla si una animación mueve una parte
  inexistente.
- Las articulaciones de `RIG` son pivotes reales: cambiarlas desplaza todo lo que cuelga.
- Toda pieza nueva debe ser una ruta SVG en `parts.ts` con un `fill` de la unión `Tinte`
  (`piel`, `pelo`, `ropa`, `metal`, `madera`, `oscuro`, `pantalon`). No se cargan archivos.
- **Las rutas de arma no pueden llevar arcos (`a`/`A`)**: `scalePath` escala solo la x
  suponiendo pares x,y, y lanza una excepción si detecta un arco.
- `lookFrom()` debe seguir siendo determinista y puro: el mismo nombre da siempre el mismo
  peleón, y hay un test que lo comprueba.
- **Ampliar el nº de variantes no basta.** Los rangos de `Appearance` los fija el motor
  (`rollAppearance`), y están **guardados en la base**. Añadir una tercera cabeza sin ampliar
  el rango de `head` solo cambia el reparto; ampliar el rango no toca a quien ya existe.

**Del reproductor de combate:**

- Lienzo fijo de **900 × 420** (`SIZE` en `pixiScene.ts`), escalado por CSS. Cualquier
  composición se define en esas coordenadas.
- El HUD ocupa los primeros ~45 px de alto; la línea de suelo está en `y = 348,6`.
- Una acción de un peleón dura **exactamente `SEGUNDOS_POR_ACCION`** (hoy 1,5 s), o el doble si
  hay contraataque. **Hay un test que falla si esa invariante se rompe.**
- Los últimos 150 ms de cada turno son quietud deliberada.
- **Todo lo que se anima se crea antes de reproducir.** Si se crean objetos sobre la marcha,
  "ir al final" y "repetir" dejan la escena a medias.
- **Todo `fromTo` debe pasar por el envoltorio `fromTo(tl, …)` de `timeline.ts`**, que fuerza
  `immediateRender: false`. Sin eso, los números y proyectiles aparecen desde el fotograma cero.

**Del e2e** — cambiar estos textos rompe `e2e/flujo.spec.ts`:

- La etiqueta del campo «Nombre del peleón», los botones «Crear», «Ir al final», los enlaces
  «Buscar pelea» / «Elegir mejora», el `aria-label` «Retrato del peleón», el texto
  «Guarda este enlace», el patrón «Se acabó en N turnos» y los enlaces «Ganó»/«Perdió» del
  historial. También la clase `.rejilla`, que el test usa para localizar rivales y opciones.

**De contenido** (`plan.md` §11, no negociable): nombres, textos y arte originales de este
proyecto. Nada de reproducir la composición, la paleta ni el diseño de personaje de otro juego.
Cualquier tipografía web que se añada necesita licencia verificada y entrada en `CREDITS.md`.

---

## Preguntas abiertas

1. **¿Hasta dónde ampliar `Appearance`?** Añadir barbas, cicatrices o accesorios se puede hacer
   como campos nuevos o reutilizando rango en los existentes. Los campos nuevos obligan a
   migrar la columna `Json` y a decidir qué ven los peleones ya creados: ¿un valor por defecto,
   o se recalcula rompiendo su aspecto actual?
2. **¿La cara se mantiene fija para siempre?** Hoy `Appearance` se congela al crear. Si se
   quiere que el peleón cambie al subir de nivel (cicatrices tras muchas derrotas, por ejemplo),
   eso es una regla de juego nueva, no una decisión de arte.
3. **Dirección visual de la interfaz.** El arte del combate tiene identidad (trazo grueso, color
   plano, cabezón, paleta cálida) y la interfaz la ignora por completo. ¿Se lleva la paleta del
   arte a la interfaz, o la interfaz tiene su propio registro?
4. **El ranking en móvil.** Cuatro columnas en 400 px. ¿Se recorta a dos, se apila en tarjetas,
   o se acepta el scroll horizontal?
5. **¿Retratos en el ranking y en el historial?** Hoy ninguna de las dos respuestas trae
   `appearance`. Añadirlo es barato en el servidor, pero conviene decidirlo antes de diseñar.
6. **Tipografía.** Hoy todo es `system-ui` salvo los carteles del combate, que usan `Georgia`.
   Si se quiere una fuente propia, hay que elegirla con licencia verificada y asumir el peso de
   descarga en una pantalla que ya carga 360 kB de PixiJS.
7. **¿Modo oscuro?** No hay ninguna previsión hoy. Afecta a cómo se definan los tokens.
