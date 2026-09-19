# PLAN.md — Juego de peleas automáticas inspirado en El Bruto

> Nombre: **Camorra**. Pendiente de verificar contra el registro de marcas antes de publicar.
> Ojo: "Camorra" es tambien el nombre de la mafia napolitana. En espanol es palabra corriente
> ("buscar camorra"), pero la asociacion existe.
> Mecánicas inspiradas en El Bruto (Motion Twin). **No usar** su nombre, arte, textos ni sonidos: todo el contenido visual y textual debe ser original.

## 1. Visión

Juego web multijugador asíncrono. Creas un luchador solo con un nombre y lo mandas a pelear contra luchadores de otros jugadores. Los combates son automáticos y se ven como una animación. Al ganar experiencia subes de nivel y eliges entre dos mejoras (arma, habilidad, mascota o estadística).

### Alcance del MVP

- Crear luchador por nombre, sin registro. Acceso por URL y cookie.
- Apariencia y estadísticas iniciales generadas a partir del nombre.
- Combates automáticos contra luchadores de nivel similar (de otros jugadores o bots).
- Límite de peleas diarias.
- Experiencia, subida de nivel y elección entre 2 mejoras.
- Historial de combates y repetición de cualquier combate por enlace público.
- Estilo visual vectorial tipo cartoon.

### Fuera del MVP (fases futuras)

- Pupilos (enlace de invitación que te da beneficios).
- Torneos diarios.
- Ranking global.
- Sonido y música.

## 2. Principio técnico central

**El combate se simula completo en el servidor y el cliente solo lo reproduce.**

- `simulate(fighterA, fighterB, seed)` es una función pura y determinista que devuelve el ganador y una lista de eventos.
- El servidor guarda la semilla, las copias ("snapshots") de ambos luchadores, la versión del motor y el log de eventos.
- El cliente recibe el log y lo anima. Nunca decide nada del resultado.
- Reglas del motor:
  - Prohibido `Math.random()`, `Date` o cualquier fuente no determinista. Usar un PRNG con semilla (p. ej. `mulberry32` o `sfc32`).
  - Usar enteros o redondeo explícito en todos los cálculos para evitar diferencias de coma flotante.
  - Sin dependencias externas y sin I/O.
  - Exportar `ENGINE_VERSION`. Si cambian las reglas, se incrementa, y los combates antiguos se siguen mostrando con su log guardado.

## 3. Stack

| Capa                 | Tecnología                                                         |
| -------------------- | ------------------------------------------------------------------ |
| Lenguaje             | TypeScript (strict) en todo el proyecto                            |
| Monorepo             | pnpm workspaces                                                    |
| Motor de combate     | `packages/engine`, TS puro, sin dependencias                       |
| Esquemas compartidos | `packages/shared` con Zod (DTOs de la API, tipos de eventos)       |
| Backend              | Node 22 + Fastify                                                  |
| Base de datos        | PostgreSQL 16 + Prisma                                             |
| Frontend             | Vite + React + React Router + TanStack Query                       |
| Render del combate   | PixiJS v8 (canvas/WebGL) + GSAP para las líneas de tiempo          |
| Tests                | Vitest (motor y backend), Playwright (flujo principal, fase final) |
| Calidad              | ESLint + Prettier, CI con GitHub Actions                           |
| Local                | Docker Compose para PostgreSQL                                     |

### Estructura

```
/
├── apps/
│   ├── server/        # Fastify + Prisma
│   └── web/           # React + PixiJS
├── packages/
│   ├── engine/        # simulate(), PRNG, catálogo, reglas
│   └── shared/        # esquemas Zod, tipos de eventos y DTOs
├── docker-compose.yml
├── PLAN.md
└── CLAUDE.md
```

## 4. Identidad sin login

- **Guardián (Keeper):** usuario anónimo. Al entrar por primera vez se crea uno y se guarda su token en una cookie `httpOnly`, `secure`, `sameSite=lax`.
- Cada luchador pertenece a un guardián. Un navegador puede tener varios luchadores.
- Al crear un luchador se genera también un **enlace de recuperación** (`/claim/:token`). Se muestra una sola vez con el aviso de guardarlo. Abrirlo en otro navegador asocia el luchador a ese guardián.
- En la base de datos se guardan solo los **hashes** de los tokens (SHA-256), nunca el valor en claro.
- Páginas públicas: perfil de cualquier luchador (`/b/:name`) y repetición de combates (`/fight/:id`).
- Acciones de dueño (pelear, subir de nivel) requieren que el guardián de la cookie sea el dueño.
- Anti-abuso: rate limit por IP en creación de luchadores y en endpoints de escritura (`@fastify/rate-limit`).

## 5. Modelo de datos (Prisma)

```
Keeper
  id, tokenHash (unique), createdAt

Brute
  id
  name            # único, sin distinguir mayúsculas; guardar también slug normalizado
  slug (unique)
  keeperId
  claimTokenHash (unique)
  level, xp
  endurance, strength, agility, speed
  weapons   String[]   # ids del catálogo
  skills    String[]
  pets      String[]
  appearance Json      # derivada del nombre, guardada para no depender de cambios futuros
  wins, losses
  fightsToday, lastFightDay (Date)
  isBot Boolean
  createdAt

LevelUpChoice
  id, bruteId (unique), level, options Json  # exactamente 2 opciones pendientes

Fight
  id
  bruteAId, bruteBId, winnerId
  seed, engineVersion
  snapshotA Json, snapshotB Json
  log Json
  createdAt
```

- Los catálogos de armas, habilidades y mascotas viven en código (`packages/engine`), no en la base de datos.
- Índices: `Brute(level)` para buscar oponentes, `Fight(bruteAId, createdAt)` y `Fight(bruteBId, createdAt)` para el historial.

## 6. Reglas del juego (valores iniciales, se ajustan con el script de balance)

### Creación

- La semilla del luchador es un hash del slug.
- Estadísticas iniciales: `endurance`, `strength`, `agility` y `speed` repartiendo 12 puntos, con mínimo 2 en cada una, usando el PRNG.
- Vida máxima: `floor(50 + endurance * 6 + level * 1.5)`. El término por nivel sube la vida en paralelo al daño, para que el combate no se acorte al subir de nivel.
- Empieza con 1 mejora aleatoria: arma o habilidad. Nunca mascota: a nivel 1 desequilibra.

### Progresión

- Victoria: +2 XP. Derrota: +1 XP. Solo gana XP quien ataca; el récord se apunta a los dos.
- XP para subir: `level * 5`.
- Al subir de nivel se ofrecen 2 opciones distintas. **La primera es siempre de estadística**, para no obligar a llevarse un arma o un bicho que no se quiere.
- Opción de estadística: **+3 a una**, o **+2 y +1** repartidos entre dos.
- La segunda opción se sortea ponderada: arma 35%, habilidad 35%, mascota 10%, estadística 20%. A partir de la cuarta arma, el peso de "arma" baja a 10%: solo se empuña una, así que la quinta no aporta.
- No se ofrece nada que el luchador ya tenga. Con una elección pendiente no se puede pelear.
- Peleas diarias: 6. El reinicio ocurre a medianoche según `GAME_TIMEZONE`.

### Oponentes

- Mostrar 6 luchadores de nivel `level ± 1`, al azar, excluyendo los propios.
- Si no hay suficientes, completar con bots (`isBot = true`) del script de seed, niveles 1 a 30.
- **El seed es correctivo, no solo idempotente:** al cambiar las reglas del motor hay que volver a correrlo, o los bots se quedan congelados en las reglas del día que se sembraron y el juego se descalibra sin que se note.

### Combate

Las reglas las fija `COMBATE.md`, que manda sobre esta sección donde haya conflicto. Resumen de lo implementado:

- Participantes: los dos luchadores y sus mascotas. El combate termina solo cuando un **luchador** llega a 0.
- **Iniciativa:** actúa quien tenga menor tiempo de próxima acción. Tras actuar suma `round(weapon.interval * 100 / (10 + speed))`, con un **±18% de azar**. Sin ese azar, dos luchadores iguales alternan en lockstep y nunca encadenan dos acciones seguidas.
- Cada luchador entra empuñando **su mejor arma contra ese rival** (mayor daño esperado por unidad de tiempo), no una al azar.
- **Acción**, por pesos: atacar 60, sacar otra arma 12, lanzar 12, habilidad activa 18. Lo imposible pasa a 0.
- **Objetivo:** el luchador rival (peso 5) o una de sus mascotas vivas (peso 1 cada una).

**Resolución, en este orden:**

1. **Esquiva:** `clamp(22 + defender.agility * 2 - weapon.accuracyBonus, 5, 36)` por ciento. Si esquiva, el defensor puede **contraatacar**: su probabilidad de contra, más 25 si empuña un arma larga. El contraataque no encadena.
2. **Bloqueo:** solo si el defensor tiene habilidad de bloqueo.
3. **Daño:** `weapon.damage + floor(aporte * strengthScale / 100)`, con variación ±20%. El `aporte` es la fuerza, salvo en las arrojadizas, donde es `agility * 0.7 + strength * 0.3`. Se resta la armadura del defensor, salvo con arma **pesada**, que la ignora. Mínimo 1.
4. **Combos:** tras un impacto, se tira `clamp(weapon.comboRate + agility * 2, 0, 45)`. Hasta **3 impactos** por acción, y cada uno hace el **70% del anterior** (del impacto previo, no de la base). Cada impacto emite su propio `hit` y `damage`.

**Gestión de armas:**

- Cambiar de arma **descarta** la que se llevaba: por eso el arsenal se agota dentro del combate.
- Las **arrojadizas solo se lanzan**, nunca se usan de cerca, y **no se agotan**. Cualquier otra arma lanzada queda inutilizable.
- Ser desarmado deja el arma inservible. Sin arma se pelea a puños, siempre disponibles.
- `disarm` solo mediante la habilidad activa correspondiente.

**Mascotas:** cuestan resistencia al dueño (chucho 2, mastín 4, jabalí 8, con suelo en 0). Pelean por ti, pero te hacen más frágil.

**Tope de turnos:** 500. Si se alcanza, gana quien tenga mayor porcentaje de vida restante.

**Cómo se mide el equilibrio:** `pnpm balance` comprueba los objetivos de sensación de `COMBATE.md` §3 y las victorias por categoría de arma **cara a cara, con ambos armados**. Medir "tener arma contra no tenerla" da 86% para cualquier categoría: eso mide que un arma vale más que una habilidad, no que una categoría domine a otra.

### Catálogo inicial (nombres y efectos originales)

- **10 armas**, dos por cada una de las 5 categorías: rápida, media, larga, pesada, arrojadiza. Campos: `id, name, category, damage, accuracyBonus, interval, comboRate, strengthScale, reach, throwable`.
- **10 habilidades**, mezcla de pasivas (más vida, más agilidad, bloqueo, contraataque) y activas (curación única, golpe fuerte, desarmar). Campos: `id, name, type, effect`. _(Ajustado en Fase 1: `trigger` era redundante, `type` + `effect` ya determinan cuándo se aplica.)_
- **3 mascotas** con stats propias y un `enduranceCost` que paga el dueño.

## 7. Eventos del combate

Los tipos los define **`packages/engine`** (TypeScript plano), que es quien los produce y no puede depender de Zod (§12). **`packages/shared`** construye encima la unión discriminada de Zod por `type`, más una comprobación a nivel de tipo que rompe `pnpm typecheck` si los dos se desincronizan. Tipos de evento:

`start`, `spawn`, `turn`, `move`, `attack`, `hit`, `evade`, `block`, `counter`, `damage`, `heal`, `drawWeapon`, `throwWeapon`, `disarm`, `skill`, `death`, `end`.

- Cada evento referencia a los combatientes por id (`A`, `B`, `A-pet-0`, etc.).
- `damage` incluye la vida restante para que el cliente no tenga que calcular nada.
- El log debe ser suficiente para animar el combate sin volver a ejecutar el motor.

## 8. API (Fastify, prefijo `/api`)

| Método | Ruta                      | Acceso  | Descripción                                                          |
| ------ | ------------------------- | ------- | -------------------------------------------------------------------- |
| GET    | `/me`                     | cookie  | Guardián actual y sus luchadores (lo crea si no existe)              |
| POST   | `/brutes`                 | cookie  | Crear luchador `{ name }` → luchador + enlace de recuperación        |
| POST   | `/claim`                  | cookie  | `{ token }` asocia un luchador al guardián actual                    |
| GET    | `/brutes/:slug`           | público | Perfil, stats, equipo, récord                                        |
| GET    | `/brutes/:slug/fights`    | público | Historial paginado                                                   |
| GET    | `/brutes/:slug/opponents` | dueño   | 6 oponentes sugeridos                                                |
| POST   | `/brutes/:slug/fights`    | dueño   | `{ opponentSlug }` → ejecuta y guarda el combate, devuelve `fightId` |
| GET    | `/brutes/:slug/level-up`  | dueño   | Opciones pendientes                                                  |
| POST   | `/brutes/:slug/level-up`  | dueño   | `{ choiceIndex }` aplica la mejora                                   |
| GET    | `/fights/:id`             | público | Snapshots + log para la repetición                                   |

- Validar entrada y salida con los esquemas Zod de `packages/shared`.
- El endpoint de combate debe ser transaccional: verificar límite diario, sin elección pendiente, oponente válido; ejecutar `simulate`; guardar combate; actualizar XP, récord y peleas del día; crear `LevelUpChoice` si corresponde.
- Validación de nombres: 5 a 20 caracteres, letras, números, guion, guion bajo y espacio; lista de palabras bloqueadas. Los límites viven en `NAME_MIN`/`NAME_MAX` de `packages/shared`. _(Ajustado en Fase 3: con 3 salían nombres como "asd".)_

## 9. Frontend

### Rutas

- `/` — crear luchador y lista de "mis luchadores".
- `/b/:slug` — ficha (celda): personaje, stats, armas, habilidades, mascotas, historial, botón de pelear si eres dueño.
- `/b/:slug/arena` — elegir oponente entre 6.
- `/b/:slug/level-up` — elegir entre 2 mejoras.
- `/fight/:id` — repetición del combate, con botón para copiar enlace.
- `/claim/:token` — recuperar luchador.

### Render del combate (PixiJS)

- Componente React que monta una `Application` de Pixi y la destruye al desmontar.
- `FightPlayer` recibe el log y construye una línea de tiempo GSAP: cada tipo de evento tiene una función que genera sus tweens.
- **Ritmo: una acción de un peleón dura un segundo**, siempre. Los eventos de ese turno se reparten ese segundo según su peso. Un contraataque añade otro segundo, porque es otra acción. _(Antes cada evento traía su propia duración y un turno podía durar 0,32 s o 2,0 s: se veía a tirones.)_ Se mide con `pnpm --filter @camorra/web ritmo`.
- Controles: reproducir/pausar, velocidad x1/x2, saltar al final.
- Barras de vida y nombres como overlay.
- Diseño responsive, pensado también para móvil.

### Personajes vectoriales (estilo cartoon)

- **Rig tipo "paper doll":** cada personaje se arma con partes SVG separadas (cabeza, pelo, torso, brazo superior e inferior, piernas, arma en mano) como sprites anidados con pivotes en las articulaciones.
- **Apariencia desde el nombre:** el hash elige variantes de cada parte y una paleta de colores (piel, pelo, ropa), aplicada con `tint` o generando el SVG con los colores ya puestos.
- **Animaciones definidas en código** como keyframes de rotación y posición por parte: `idle`, `walk`, `attack` (por categoría de arma), `hit`, `evade`, `block`, `throw`, `death`, `victory`.
- Las armas y mascotas también son SVG.
- Primera iteración con figuras geométricas simples; el arte final se reemplaza sin tocar la lógica, siempre que respete los nombres de partes y los pivotes.
- Las partes SVG deben tener trazo grueso, colores planos y proporciones exageradas (cabeza grande).

## 10. Fases de desarrollo

Cada fase termina con tests pasando, lint limpio y un commit.

### Fase 0 — Base del proyecto

- Monorepo pnpm, TypeScript strict, ESLint, Prettier, Vitest.
- Docker Compose con PostgreSQL.
- CI en GitHub Actions: instalar, lint, typecheck, test.
- **Listo cuando:** `pnpm test` y `pnpm dev` funcionan en limpio.

### Fase 1 — Motor de combate

- PRNG con semilla, generación de luchador desde nombre, catálogo, `simulate()`, generación de opciones de nivel.
- Tests:
  - Misma entrada → mismo log (determinismo).
  - Todo combate termina (propiedad probada con miles de semillas).
  - Ningún evento referencia a combatientes muertos.
  - La vida nunca es negativa ni supera el máximo.
- Script `pnpm balance` que simula 10.000 combates entre luchadores aleatorios del mismo nivel e imprime tasa de victoria por arma, habilidad y mascota, y duración media.
- **Listo cuando:** ningún elemento del catálogo supera el 60% de victorias en el script de balance.

### Fase 2 — Backend

- Esquema Prisma y migraciones.
- Guardianes, cookies y enlaces de recuperación.
- Todos los endpoints de la sección 8 con validación Zod.
- Script de seed con bots.
- Tests de integración contra una base de datos de test.
- **Listo cuando:** se puede crear un luchador, pelear, subir de nivel y ver un combate solo con llamadas HTTP.

### Fase 3 — Frontend funcional

- Todas las rutas de la sección 9.
- El combate se muestra primero como **log de texto** animado (una línea por evento).
- **Listo cuando:** el ciclo completo se juega en el navegador.

### Fase 4 — Render del combate con placeholders

- `FightPlayer` con PixiJS y GSAP usando formas simples.
- Todos los tipos de evento tienen animación.
- **Listo cuando:** cualquier combate guardado se reproduce de principio a fin sin errores.

### Fase 5 — Arte vectorial

- Rig paper doll con partes SVG, variantes generadas desde el nombre, animaciones completas, armas y mascotas.
- Mismo personaje en la ficha y en el combate.
- **Listo cuando:** dos nombres distintos producen personajes visiblemente distintos y todas las animaciones se ven bien.

### Fase 6 — Pulido y despliegue

- Estados de carga y error, páginas 404, metadatos Open Graph para compartir combates.
- Test end-to-end con Playwright del flujo principal.
- Despliegue (p. ej. Fly.io, Railway o Render con PostgreSQL gestionado). El servidor sirve el build estático del frontend.
- **Listo cuando:** está en línea y el flujo principal pasa en producción.

### Fases futuras

- ~~Ranking.~~ **Hecho:** `GET /api/ranking` y la página `/ranking`, ordenando por nivel y victorias, con los bots fuera. La ficha trae el puesto y una cuenta atrás hasta la próxima tanda de peleas.
- ~~Pupilos.~~ **Hecho:** enlace `/reclutar/:slug`. Cada recluta da al maestro **+1 pelea diaria**, con tope de +6. Reclutarse a uno mismo no cuenta (se comprueba el guardián), y un bot no puede ser maestro.
- Torneos diarios por nivel.
- Sonido.

## 11. Restricciones de contenido original (obligatorias)

Las mecánicas y reglas de un juego no están protegidas por derecho de autor, pero la expresión concreta sí. Estas restricciones aplican a todas las fases.

### Prohibido

- Usar los nombres "El Bruto", "La Brute" o "MyBrute" en el título, el dominio, el logo, la interfaz, los metadatos o las palabras clave. En el README se puede decir "inspirado en", nada más.
- Copiar o extraer arte, sprites, sonidos, música, fuentes o textos del juego original o de cualquier versión ripeada.
- Copiar los nombres propios de armas, habilidades y mascotas del original.
- Copiar código de remakes existentes (incluido el de Eternaltwin). Si se consulta alguno como referencia conceptual, revisar antes su licencia: si es GPL o AGPL, copiar código obliga a liberar este proyecto bajo la misma licencia. Lo correcto es escribir una implementación propia.
- Reproducir la composición de pantalla, la paleta y el diseño de personaje del original de forma casi idéntica.

### Obligatorio

- Inventar nombres propios para las 10 armas, las 10 habilidades y las 3 mascotas. Deben sonar a este juego, no ser traducciones ni variantes de los del original.
- Todo el arte SVG se dibuja desde cero para este proyecto, con un estilo cartoon y una paleta definidos aquí y distintos a los del original.
- Todos los textos de interfaz son originales.
- Las fuentes tipográficas deben tener licencia de uso web verificada (p. ej. SIL Open Font License) y quedar documentadas en `CREDITS.md`, junto con cualquier otro recurso de terceros y su licencia.
- Elegir un nombre y un dominio propios antes del despliegue (Fase 6), y verificar que no colisionen con una marca existente en el registro de marcas correspondiente.

### Contenido generado por usuarios

Como el nombre del luchador es texto libre, los usuarios crearán personajes con nombres de marcas, personajes de ficción o personas reales. Incluir desde la Fase 2:

- Lista de palabras bloqueadas en la validación de nombres, configurable y fácil de ampliar.
- Un endpoint o formulario para reportar un luchador.
- Una forma sencilla de renombrar o eliminar un luchador a petición (comando administrativo basta).
- En la Fase 6: términos de uso, política de privacidad (la cookie de guardián) y una dirección de contacto para solicitudes de retiro.

## 12. Instrucciones para Claude Code

- Trabajar **una fase a la vez**, en orden. No avanzar sin que se cumpla el criterio de "Listo cuando".
- Antes de cada fase, proponer un plan corto de tareas y esperar confirmación.
- El motor (`packages/engine`) no puede importar nada de `apps/*` ni tener dependencias externas.
- Todo lo que cruce la red se valida con los esquemas de `packages/shared`.
- Si una regla de la sección 6 resulta problemática, proponer el cambio en lugar de improvisarlo, y actualizar este archivo.
- La sección 11 no es negociable. Al escribir el catálogo, los textos de interfaz o el arte, si un nombre o un diseño se parece al del juego original, cambiarlo. Ante la duda, preguntar.
- Mantener `CLAUDE.md` con comandos útiles y convenciones que vayan surgiendo.
