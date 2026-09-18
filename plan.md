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
- Vida máxima: `50 + endurance * 10`. _(Ajustado en Fase 1: con `* 6` los combates duraban ~27 turnos, demasiado poco para animarlos.)_
- Empieza con 1 mejora aleatoria: arma o habilidad. _(Ajustado en Fase 1: una mascota a nivel 1 desequilibra el combate.)_

### Progresión

- Victoria: +2 XP. Derrota: +1 XP.
- XP para subir: `level * 5`.
- Al subir de nivel se generan 2 opciones distintas con el PRNG, ponderadas: arma 35%, habilidad 35%, mascota 10%, estadística 20% (+2 a una o +1 a dos).
- A partir de la cuarta arma el peso de "arma" baja de 35% a 10%. _(Ajustado en Fase 1: solo se empuña un arma a la vez, así que la quinta no aportaba nada y la elección era un trámite.)_
- No se ofrece nada que el luchador ya tenga.
- Con una elección pendiente no se puede pelear.
- Peleas diarias: 6. El reinicio ocurre a medianoche según `GAME_TIMEZONE` (variable de entorno).

### Oponentes

- Mostrar 6 luchadores de nivel `level ± 1`, al azar, excluyendo los propios.
- Si no hay suficientes, completar con bots (`isBot = true`) creados por el script de seed para los niveles 1 a 30.

### Combate

- Participantes: los dos luchadores y sus mascotas. Las mascotas son combatientes con sus propias stats, pero el combate termina solo cuando un luchador llega a 0 de vida.
- **Iniciativa:** cada combatiente tiene un tiempo de próxima acción. Actúa el menor. Tras actuar suma `delay = weapon.baseDelay * 10 / (10 + speed)` (redondeado).
- Cada luchador **entra al combate empuñando su mejor arma contra ese rival** (mayor daño esperado por unidad de tiempo), no una al azar. _(Ajustado tras la Fase 6: con un arma al azar, conseguir un arma mejor no te mejoraba, solo añadía un boleto más al sorteo, y las armas eran la peor categoría del catálogo.)_ _(Ajustado en Fase 1: empezar desarmado gastaba turnos y hundía a todas las armas por debajo del 40% de victorias.)_
- **Acción del luchador** en su turno, elegida con el PRNG según pesos: atacar 60, sacar un arma nueva 12, lanzar el arma 5, activar una habilidad activa 18. Los pesos de las acciones imposibles pasan a 0.
- **Objetivo:** el luchador rival (peso 5) o una de sus mascotas vivas (peso 1 cada una).
- **Resolución:**
  - Probabilidad de impacto: `clamp(weapon.accuracy - defender.agility * 2, 10, 95)` (en porcentaje).
  - Si falla, el log registra `evade`. Si el defensor tiene una habilidad de bloqueo, puede registrar `block`.
  - Daño: `weapon.damage + floor(strength * weapon.strengthScale / 100)`, con variación de ±20% vía PRNG.
  - `counter`: el defensor contraataca una vez si tiene la habilidad. No encadena.
  - **Cada categoría de arma tiene un efecto propio**, y cada uno contrarresta una habilidad concreta _(añadido tras la Fase 6, para que elegir arma compita con elegir habilidad o mascota)_:
    - **pesada** ignora la armadura del defensor (contra _Callo Viejo_).
    - **larga** reduce a la mitad su probabilidad de bloqueo (contra _Mano Zurda_).
    - **rápida** no admite contraataque (contra _Revire_).
    - Lanzar un arma hace **el doble de daño**: se pierde, así que si no doliera nunca compensaría.
  - `disarm`: solo mediante la habilidad activa correspondiente. _(Simplificación de Fase 1: ningún arma desarma por sí sola.)_
- **Tope de turnos:** 500. Si se alcanza, gana quien tenga mayor porcentaje de vida restante.

### Catálogo inicial (nombres y efectos originales)

- **10 armas** en categorías: rápida, pesada, larga, arrojadiza. Campos: `id, name, category, damage, accuracy, baseDelay, strengthScale, reach, throwable`.
- **10 habilidades**, mezcla de pasivas (más vida, más agilidad, bloqueo, contraataque) y activas (curación única, golpe fuerte, desarmar). Campos: `id, name, type, effect`. _(Ajustado en Fase 1: `trigger` era redundante, `type` + `effect` ya determinan cuándo se aplica.)_
- **3 mascotas** (p. ej. perro, lobo, oso) con stats propias.

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

- Pupilos: enlace de invitación, bonificaciones para el maestro.
- Torneos diarios por nivel.
- Ranking.
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
