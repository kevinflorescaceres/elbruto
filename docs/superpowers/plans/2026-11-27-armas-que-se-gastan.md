# Armas que se gastan — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** que las armas se consuman durante el combate de forma coherente con lo que son. Las arrojadizas tienen un número de lanzamientos (la Botija revienta al primero) y las de mano tienen una probabilidad de romperse al golpear (la Banqueta se rompe a menudo y una vara casi nunca). Así llevar varias armas encima vale la pena.

**Arquitectura:** dos campos nuevos en `Weapon` (`stock`, `breakChance`), un contador de munición por combate en `Combatant` y un evento de log nuevo, `weaponLost`. Cuando se pierde el arma se vuelve a los puños, y en la acción siguiente echar mano de otra pasa a ser lo más probable. Motor 6. La web narra y anima el evento nuevo, y la pantalla de subir de nivel enseña el stock y la fragilidad.

**Stack:** TypeScript, Vitest y Zod (`packages/shared`). En la web, React y PixiJS.

**Spec:** no hay documento aparte. Las decisiones están en la sección «Decisiones», que sale de la conversación del 2026-11-27.

## Decisiones

Lo que pidió Kevin:
- Variedad de armas. Tener más armas debe ser deseable y cada arma debe usarse como lo que es.
- Arrojadizas con stock: algunas de un solo uso (garrafa de greda, botella de vino) y otras con stock limitado (5 cuchillos).
- Probabilidad de rotura por arma: la banqueta muy frágil, una vara casi irrompible.

Lo que decido yo (Kevin puede corregirlo):
1. **`stock: number | null`.** Es el número de lanzamientos por combate. Solo lo llevan las arrojadizas; las demás armas llevan `null`. **Ninguna arrojadiza es infinita.**
2. **`breakChance: number`** (0-100). Se tira **en cada impacto que conecta**, y el bloqueo cuenta como un impacto. Nunca se tira cuando el rival esquiva. Si el arma se rompe en el impacto 1 o 2 de un combo, el combo se corta ahí. Las arrojadizas llevan 0 porque ya se gastan con el stock. Puños y bichos llevan 0. Si el ataque mata, no se tira.
3. **Evento `weaponLost { id, weapon, reason: 'rota' | 'agotada' }`.** Se emite **después** del ataque, para que se vea el golpe y luego el arma rota. En una arrojadiza de stock 1 el motivo es `'rota'` (se revienta en la cabeza aunque falle). En una de stock mayor que 1, cuando se acaba, el motivo es `'agotada'`. Al romperse un arma de mano, el motivo es `'rota'`.
4. **Al perder el arma**, se queda en `FISTS`, se quita de `weapons` y no vuelve hasta el combate siguiente. En `act`, si va a puños y le quedan armas, el peso de `draw` sube de 12 a **60**. Cambiar de arma sigue costando el turno. Ese es el sitio donde llevar más armas paga.
5. **Catálogo nuevo** con los tres ejemplos de Kevin. El arte va por categoría (`weaponShapes(category, reach)`), así que añadirlos no cuesta dibujos:
   - **Garrafa de Greda**: arrojadiza, stock 1, pega fuerte y es fácil de esquivar.
   - **Cuchillos de Tiro**: arrojadiza, stock 5, pegan poco y son precisos.
   - **Vara de Fresno**: larga, con `breakChance` 1.
6. **Valores de partida**, que se ajustan en la Tarea 5:

   | arma | stock | breakChance | cambio de daño |
   |---|---|---|---|
   | Puños | null | 0 | — |
   | Chaira, Puntilla | null | 1 | — |
   | Jifero, Verduguillo | null | 2 | — |
   | Porra de Corchete | null | 4 | — |
   | Chuzo de Sereno | null | 5 | — |
   | Tranca de Portón | null | 8 | — |
   | Banqueta de Taberna | null | 30 | 18 → 22 |
   | Cascote | 3 | 0 | — |
   | Botija de Vino | 1 | 0 | 10 → 24 |
   | Garrafa de Greda | 1 | 0 | 28, precisión −4, intervalo 90, `strengthScale` 70, alcance 3 |
   | Cuchillos de Tiro | 5 | 0 | 6, precisión +5, intervalo 56, `strengthScale` 60, alcance 3 |
   | Vara de Fresno | null | 1 | 9, precisión +3, intervalo 86, combo 6, `strengthScale` 75, alcance 4 |

7. Fuera de alcance: **rediseñar las siluetas de las armas** (la banqueta parece una pala) y crear armas con arte propio, que irán en un plan aparte; mañas o bichos nuevos (el objetivo general de "más elementos" va en planes aparte), reparar armas y mostrar la munición restante en el lienzo.

## Restricciones globales

- `packages/engine`: cero dependencias, sin `Math.random` ni `Date`, solo imports relativos (ESLint lo bloquea).
- `ENGINE_VERSION` pasa de **5** a **6**. Los combates viejos se reproducen desde su log y no se vuelven a simular.
- Todo evento nuevo va en el esquema Zod de `packages/shared/src/fight.ts`, y `assertSameShape` tiene que seguir compilando.
- Textos al jugador en español con tildes. Comentarios del código sin tildes.
- La web no duplica nombres de armas: siempre `getWeapon`.
- Criterio de balance: `pnpm balance` contra 3 puntos (`frenteAPuntos`) dentro de [35, 65]. Si un objetivo no se alcanza sin romper otro, se reportan los números medidos en vez de forzarlo (combate.md).
- Commits: uno por tarea, **solo cuando Kevin lo autorice**, en formato `type(scope): resumen` en español y sin trailers.

## Puntos que revisar

1. **Log viejo (motor 5) en la web.** No trae `weaponLost` y tiene que seguir narrándose y animándose igual. Lo cubre la Tarea 4: un test con un log sin el evento.
2. **Arrojadiza en la mano al empezar.** `equipBest` puede elegir la Botija, y al tirarla se queda a puños. Que no se quede atascado a puños con armas en el inventario lo cubre el test de la Tarea 3: «tras perder el arma, la siguiente acción con armas restantes es casi siempre `drawWeapon`».
3. **Contraataque o Desjarrete con un arma que se rompe.** `resolveAttack` se llama desde el contraataque, Golpe de Mula (`power`) y Desjarrete. La rotura se aplica en todos, porque sale de `resolveAttack`, y solo si `weapon === attacker.weapon`. Un arma lanzada con `throwWeapon` no es el arma de la mano hasta después. Lo cubre el test de la Tarea 3: «nunca hay un ataque con un arma ya perdida».
4. **Muerte en el golpe que rompe.** No se emite `weaponLost` después de `death`. Lo cubre el test que ya existe «nada ocurre despues del evento end», más uno nuevo en la Tarea 3.
5. **Arma nueva en un peleón viejo.** Los peleones guardados en la BD no tienen las armas nuevas, y `validate.ts` acepta cualquier id del catálogo. No hay migración: solo se ofrecen al subir de nivel. Lo cubre la Tarea 2, que comprueba que `rollLevelUpOptions` puede ofrecer cada id nueva.

---

### Tarea 1: Tipos, catálogo y esquema

**Archivos:**
- Modificar: `packages/engine/src/types.ts` (`Weapon`, `Combatant`, `FightEvent`)
- Modificar: `packages/engine/src/catalog.ts` (todas las armas y `FISTS`; tres armas nuevas)
- Modificar: `packages/engine/src/simulate.ts:64` (`petWeapon`: `stock: null, breakChance: 0`)
- Modificar: `packages/shared/src/fight.ts` (rama `weaponLost` en `fightEventSchema`)
- Test: `packages/engine/src/catalog.test.ts` (crear)

**Interfaces que produce:**
- `Weapon.stock: number | null` y `Weapon.breakChance: number`
- `Combatant.municion: Record<string, number>`: lanzamientos que quedan, por id de arma
- `FightEvent`: `| { type: 'weaponLost'; id: string; weapon: string; reason: 'rota' | 'agotada' }`
- Ids nuevos: `'garrafa'`, `'cuchillos'`, `'vara'`

- [ ] **Paso 1: test que falla**, en `catalog.test.ts`:
  - `it('toda arrojadiza tiene stock >= 1 y breakChance 0')`
  - `it('ninguna arma de mano tiene stock')`: `stock === null` cuando `category !== 'arrojadiza'`
  - `it('breakChance va de 0 a 100')`
  - `it('la banqueta es la mas fragil y la vara de las que menos')`: `getWeapon('banqueta').breakChance` es el máximo del catálogo y `getWeapon('vara').breakChance <= 1`
  - `it('la botija y la garrafa son de un solo uso, los cuchillos de cinco')`
- [ ] **Paso 2:** `pnpm vitest run packages/engine/src/catalog.test.ts` → FALLA (los campos no existen).
- [ ] **Paso 3:** añadir los campos y los valores de la tabla de «Decisiones §6». El comentario `throwable` de `types.ts` deja de decir "no se agotan". En `fight.ts`, `reason: z.enum(['rota', 'agotada'])`.
- [ ] **Paso 4:** `pnpm vitest run packages/engine/src/catalog.test.ts && pnpm typecheck` → PASA. `Combatant.municion` hace fallar `buildFighter` y `buildPet` hasta la Tarea 3: rellénalo ya con `{}` en los dos.
- [ ] **Paso 5:** commit `feat(engine): las armas declaran stock y probabilidad de rotura`

### Tarea 2: Armas nuevas en el reparto

**Archivos:**
- Test: `packages/engine/src/brute.test.ts`

- [ ] **Paso 1: test**: `it('rollLevelUpOptions puede ofrecer garrafa, cuchillos y vara')`. Recorre semillas con `mulberry32` hasta ver cada id en una opción de tipo `'weapon'`, con un tope de 2000 semillas.
- [ ] **Paso 2:** ejecutarlo. Si pasa sin tocar nada (el reparto sale de `WEAPONS`), basta con el test. Si falla, mira en `brute.ts` cómo se filtra el catálogo y añade los ids.
- [ ] **Paso 3:** commit `test(engine): las armas nuevas salen al subir de nivel`

### Tarea 3: El motor gasta y rompe armas (motor 6)

**Archivos:**
- Modificar: `packages/engine/src/simulate.ts` (`ENGINE_VERSION`, `buildFighter`, `resolveAttack`, `throwWeapon`, `act`)
- Test: `packages/engine/src/armas.test.ts` (crear)

**Interfaces:**
- Consume: lo de la Tarea 1.
- Produce: `function perderArma(state: State, actor: Combatant, weapon: Weapon, reason: 'rota' | 'agotada'): void`. Quita el arma de `weapons`, pone `FISTS` si era la de la mano y emite `weaponLost`.

Helper de los tests: `peleon(weapons: string[], slug = 'arm')` devuelve `{ ...growTo(createBrute(slug), 5, mulberry32(1)), weapons, skills: [], pets: [] }`, para que el resultado no dependa de mañas.

- [ ] **Paso 0:** antes de tocar `simulate.ts`, guarda la salida de `pnpm balance` en el scratchpad. Es la línea base de turnos de la Tarea 5.
- [ ] **Paso 1: tests que fallan**, en `armas.test.ts`, cada uno sobre 300 semillas:
  - `it('la botija se lanza una sola vez y se pierde rota')`: A lleva `['botija']`. Como mucho un `throwWeapon` de `botija` por combate, y tras él un `weaponLost` con `reason: 'rota'`.
  - `it('los cuchillos se lanzan como mucho 5 veces y luego se agotan')`: si hay 5 lanzamientos, el siguiente evento de A sobre ese arma es `weaponLost` con `'agotada'`.
  - `it('la banqueta se rompe en mas de la mitad de los combates largos')`: A lleva `['banqueta']`. En los combates de 20 turnos o más hay `weaponLost` de `banqueta` en más del 50%.
  - `it('un arma que se rompe a mitad de combo corta el combo')`: tras un `weaponLost` con `'rota'` no hay otro `hit` del mismo atacante hasta su siguiente `attack`.
  - `it('nunca se rompe un arma en un ataque esquivado')`: el `weaponLost` con `'rota'` de un arma de mano nunca sigue a un `evade` del mismo ataque (se recorre el log desde el último `attack`).
  - `it('nunca hay un attack con un arma ya perdida')`
  - `it('nada de weaponLost despues de death')`
  - `it('tras perder el arma, con armas restantes, la siguiente accion suele ser drawWeapon')`: A lleva `['banqueta', 'jifero', 'chaira']`. Entre las acciones de A que siguen a un `weaponLost`, más del 50% empiezan por `drawWeapon`. Con un peso de 60 frente a 60 sale un 50% de media, así que el umbral es 45%.
  - `it('ENGINE_VERSION es 6')`
- [ ] **Paso 2:** `pnpm vitest run packages/engine/src/armas.test.ts` → FALLA.
- [ ] **Paso 3: implementación**:
  - `buildFighter`: `municion` arranca con `stock` de cada arrojadiza.
  - `throwWeapon`: tras `resolveAttack`, si `thrown.stock !== null`, resta 1 en `municion`. Si llega a 0, llama a `perderArma(..., thrown.stock === 1 ? 'rota' : 'agotada')`. Si el defensor murió, no lo llames (el combate acaba en ese `death`).
  - `resolveAttack`: helper `seRompe(state, attacker, weapon): boolean`, que devuelve true si `weapon === attacker.weapon && weapon.breakChance > 0 && chance(state.rng, weapon.breakChance)`. Se llama en la rama de bloqueo y en cada vuelta del bucle de combo, después del daño y solo si el defensor sigue vivo. Si devuelve true, `perderArma(..., 'rota')` y `break` del combo. El tiro solo se hace cuando `breakChance > 0`, para no gastar RNG con los puños.
  - `act`: `draw` pesa 60 si `actor.weapon.id === FISTS.id && canDraw`, y 12 si no.
  - `ENGINE_VERSION = 6`. Actualiza el comentario de cabecera de `simulate.ts:22` y el de `throwWeapon` ("no se agota" ya no es cierto).
- [ ] **Paso 4:** `pnpm test` en el motor → PASA, incluidos `combate.test.ts` y `simulate.test.ts`. Si falla un test de `combate.test.ts` por un umbral (por ejemplo «ninguna categoria de arma domina ni es inutil a nivel 1»), anota los números y déjalo para la Tarea 5. No toques el umbral aquí.
- [ ] **Paso 5:** commit `feat(engine): motor 6, las arrojadizas se agotan y las armas de mano se rompen`

### Tarea 4: La web narra y anima `weaponLost`

**Archivos:**
- Modificar: `apps/web/src/fightLines.ts` (case `weaponLost`)
- Modificar: `apps/web/src/fightScene.ts:131` (lista de eventos visibles), `:312` (peso 400) y el `switch` de `:571`
- Modificar: `apps/web/src/pages/LevelUp.tsx:41` (detalle del arma)
- Test: `apps/web/src/fightLines.test.ts`, `apps/web/src/fightScene.test.ts`

Textos exactos:
- `rota`, larga: `` `A ${nameOf(id)} se le rompe ${weaponName(weapon)}.` ``; corta: `` `${weaponName(weapon)} se hace añicos.` ``
- `agotada`: `` `A ${nameOf(id)} se le acaban ${weaponName(weapon)}.` `` en las dos formas.
- Detalle en LevelUp, añadido al final: `stock === 1` → `· un solo uso`, `stock > 1` → `` `· ${stock} lanzamientos` ``, `breakChance >= 15` → `· frágil`.

- [ ] **Paso 1: tests que fallan**:
  - `fightLines.test.ts`: `it('weaponLost rota y agotada tienen su frase')`, con las frases de arriba sobre `banqueta` y `cuchillos`, en forma larga y corta.
  - `fightScene.test.ts`: `it('weaponLost deja al peleon a punos')`. Tras el evento hay un move `{ kind: 'weapon', id, weapon: 'punos' }`, y si es `'rota'` también `{ kind: 'toss', id, weapon }`.
  - `fightScene.test.ts`: `it('un log de motor 5 sin weaponLost se monta igual')`. Usa un log que ya exista en el test como fixture y comprueba que `duration` y `beats.length` no cambian.
- [ ] **Paso 2:** `pnpm vitest run apps/web/src/fightLines.test.ts apps/web/src/fightScene.test.ts` → FALLA.
- [ ] **Paso 3:** implementar los textos de arriba. En la escena, `'rota'` es `toss` + `weapon: 'punos'` + `float` con `¡Crac!` en `COLOR.daño`, o en el color de daño que use el archivo. `'agotada'` es solo `weapon: 'punos'`. Hay que tocar el `byId` del actor igual que en `drawWeapon`.
- [ ] **Paso 4:** `pnpm test && pnpm typecheck && pnpm lint` → PASA. Después, `pnpm --filter @camorra/web art <dir>` para ver que garrafa, cuchillos y vara salen en la hoja de armas con su silueta de categoría.
- [ ] **Paso 5:** commit `feat(web): el combate cuenta cuando un arma se rompe o se agota, y subir de nivel avisa del stock`

### Tarea 5: Balance y documentos

**Archivos:**
- Modificar: `packages/engine/src/catalog.ts` (solo números)
- Modificar: `combate.md` (§4.5 tabla, §4.7, las líneas 138-139, 170-171 y 194), `plan.md` §6/§7 con _(Ajustado en Fase 1)_ donde toque, y `CLAUDE.md` («El combate»: la línea de Arrojadizas, el motor 6 y una línea sobre la rotura)

- [ ] **Paso 1:** `pnpm balance` y `pnpm balance 5000 10` y `pnpm balance 5000 20`. Apunta el % de cada arma frente a 3 puntos.
- [ ] **Paso 2:** ajusta solo `damage` (y `breakChance` de la banqueta si hace falta) hasta que cada arma quede en [35, 65] en los niveles 3, 10 y 20. Las armas a ~42% a nivel 10-20 están dentro de lo esperado (CLAUDE.md). **Si una de un solo uso no llega a 35 sin un daño absurdo (más de 40), para y reporta los números a Kevin** en vez de forzarlo.
- [ ] **Paso 3:** comprueba que la media de turnos por combate no se ha movido más de un 15% respecto al motor 5. Mídelo con `pnpm balance` en `main` antes de la Tarea 3: guarda esa salida en el scratchpad antes de empezar.
- [ ] **Paso 4:** `pnpm test` (incluido `combate.test.ts`, sin tocar umbrales) y `pnpm e2e` → PASA.
- [ ] **Paso 5:** actualiza los documentos con los números finales. En combate.md, "no se agotan ni se pierden" pasa a describir el stock y la rotura.
- [ ] **Paso 6:** commit `feat(engine): balance de armas con stock y rotura, y combate.md al día`
