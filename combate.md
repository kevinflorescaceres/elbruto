# COMBATE.md — Ajuste del motor para acercarlo a la sensación del original

Documento para la fase de pulido. Complementa la sección 6 de `PLAN.md` y la reemplaza donde haya conflicto.

**Restricción previa (sección 11 de `PLAN.md`):** las fórmulas, curvas y números son mecánicas y se pueden replicar. Los **nombres** de armas, habilidades y mascotas siguen siendo originales de este proyecto. No copiar tablas de datos de repositorios con licencia GPL/AGPL: implementar a partir de las reglas descritas aquí.

---

## 1. Qué hace que el combate "se sienta" como el original

No son los números exactos, son cinco propiedades estructurales. Si faltan, el combate se siente distinto aunque las cifras coincidan.

1. **Golpes múltiples (combos).** Una acción de ataque puede producir 2 o 3 impactos seguidos. Es lo que hace que las armas rápidas se vean rápidas. Depende de la agilidad y del arma.
2. **Turnos consecutivos.** No hay alternancia estricta. Con velocidad alta y arma de intervalo bajo, un luchador ataca varias veces antes de que el rival responda.
3. **El arma se pierde.** Las armas se lanzan, se descartan al cambiar y se pueden desarmar. El luchador vuelve a puños o saca otra. Esto crea variación dentro del mismo combate.
4. **Fallar es frecuente.** Esquivar, bloquear y contraatacar ocurren seguido. Un combate sin fallos se ve plano.
5. **Ritmo espacial.** Los luchadores se acercan para golpear y retroceden después. La pausa entre acciones es parte del ritmo.

---

## 2. Datos verificados del juego original

Estos valores están documentados públicamente y conviene respetarlos tal cual.

### Vida

- **Vida base: 50.**
- **Cada punto de resistencia (endurance) da +6 de vida.**
- **Cada nivel da +3 de vida** (+1,5 hasta ENGINE_VERSION 4), independiente de la resistencia.
- La resistencia puede ser 0. La vida mínima posible de un luchador es 33 _(51 con la base de 50 anterior)_.
- En la práctica un luchador nivel 1 tiene alrededor de **51 de vida** (base 30 + 3 puntos de resistencia + 3 del nivel).

La fórmula actual del proyecto (`50 + endurance * 6`) es correcta. **Falta agregar el término por nivel.**

```
maxHp = floor(30 + endurance * 6 + level * 3)   # 50 y 1.5 hasta ENGINE_VERSION 4
```

### Estadísticas iniciales

- Cuatro estadísticas: resistencia, fuerza, agilidad y velocidad.
- Promedio **~3 puntos por estadística** en nivel 1, repartidos al azar.

### Qué controla cada estadística

- **Fuerza:** daño de casi todos los ataques.
- **Agilidad:** tres cosas a la vez — esquiva, **probabilidad de combo** y precisión. Además, es la estadística principal del daño de las armas arrojadizas (la fuerza influye menos).
- **Velocidad:** el intervalo entre acciones. Más velocidad significa más probabilidad de volver a atacar inmediatamente después de atacar.
- **Resistencia:** solo vida.

### Categorías de arma

- **Rápidas:** intervalo bajo, alta tasa de combo, difíciles de esquivar. Daño bajo.
- **Pesadas:** daño alto, intervalo alto, precisión más baja.
- **Largas:** tasa de contraataque elevada.
- **Arrojadizas:** cantidad ilimitada, solo se lanzan, el daño escala con agilidad.

### Progresión

- Al subir de nivel siempre hay **al menos una opción de estadística**, y esa opción es **+3 a una estadística** o un reparto **+2 / +1** entre dos.
- La otra opción puede ser arma, habilidad o mascota.

---

## 3. Objetivos de sensación (medibles)

Estos son los números a los que hay que llegar. Son objetivos propios, no datos del original: ajustar las constantes hasta cumplirlos usando el script de balance.

Combate entre dos luchadores nivel 1 sin mascotas:

| Métrica                                             | Objetivo         |
| --------------------------------------------------- | ---------------- |
| Impactos totales en el combate                      | 12 a 25          |
| Acciones totales (incluye fallos y cambios de arma) | 20 a 40          |
| Daño medio por impacto                              | 5 a 12           |
| Duración de la animación                            | 25 a 45 segundos |
| Combates que llegan al tope de turnos               | < 0.5%           |
| Acciones con combo (2+ impactos)                    | 10% a 25%        |
| Ataques que no conectan (esquiva o bloqueo)         | 20% a 35%        |
| Racha máxima de un luchador sin que el rival actúe  | 2 a 4 acciones   |

Nivel 10 contra nivel 10: mismo número de impactos aproximado, no más. La progresión debe subir daño **y** vida en paralelo, para que los combates no se acorten ni se alarguen con el nivel.

---

## 4. Implementación actual en el motor (ENGINE_VERSION 5)

> **Nota:** Las desviaciones respecto al documento original de diseño están medidas y justificadas. Ver `CLAUDE.md` §§108–150 para el detalle numérico y la trazabilidad al script `pnpm balance`.

### 4.1 Vida

```
maxHp = floor(30 + endurance * 6 + level * 3)
```

- La base cambió de 50 a 30 en ENGINE_VERSION 4; el término por nivel pasó de 1.5 a 3 al quitar el redondeo de la fuerza. Ver `packages/engine/src/brute.ts:54`.

### 4.2 Combos

Nuevo mecanismo en la resolución de un ataque. Tras un impacto exitoso, tirar de nuevo:

```
comboChance = weapon.comboRate + agility * 3   // en porcentaje (era agility * 2)
comboChance = clamp(comboChance, 0, 45)
```

- Máximo 3 impactos por acción.
- Cada impacto adicional hace **70% del daño** del anterior.
- Cada impacto adicional se tira de nuevo contra la misma probabilidad.
- Cada impacto genera su propio evento `hit` + `damage`, para que el cliente pueda animar la secuencia.
- `comboRate` por categoría (valores actuales en `catalog.ts`):
  - rápida: 16–19 (chaira 19, puntilla 16)
  - media: 8–12 (jifero 12, porra 8)
  - larga: 4–7 (verduguillo 7, vara 6, chuzo 4)
  - pesada: 0
  - arrojadiza: 0
  - puños: 12

### 4.3 Intervalo y turnos consecutivos

```
delay = round(weapon.interval * 100 / (10 + speed))
```

Valores de `interval` **actuales en `catalog.ts`** (ajustados por balance, distintos del documento de diseño):

| Arma                  | Categoría   | Interval |
| --------------------- | ----------- | -------- |
| Puños                 | rápida      | 66       |
| Chaira                | rápida      | 50       |
| Puntilla              | rápida      | 56       |
| Jifero                | media       | 76       |
| Porra de Corchete     | media       | 84       |
| Verduguillo           | larga       | 88       |
| Chuzo de Sereno       | larga       | 102      |
| Vara de Fresno        | larga       | 86       |
| Banqueta de Taberna   | pesada      | 132      |
| Tranca de Portón      | pesada      | 150      |
| Cascote               | arrojadiza  | 64       |
| Botija de Vino        | arrojadiza  | 76       |
| Garrafa de Greda      | arrojadiza  | 90       |
| Cuchillos de Tiro     | arrojadiza  | 56       |

Efecto buscado: con velocidad 3 y arma rápida, el luchador acumula rachas de 2 a 4 acciones seguidas. Verificarlo con el script de balance, no a ojo.

### 4.4 Iniciativa inicial

Al comenzar el combate, el tiempo inicial de cada luchador se sortea con el PRNG en un rango pequeño en vez de empezar ambos en 0, para que el primer golpe no sea siempre del mismo lado. Ver `simulate.ts:200-210`.

### 4.5 Daño

```
base    = weapon.damage + strength * weapon.strengthScale / 100     # sin floor desde ENGINE_VERSION 4
variado = floor(base * rand(80, 120) / 100)
final   = max(1, variado - defender.armor)   # en cada impacto desde ENGINE_VERSION 5 (antes, solo el primero)
```

Para armas arrojadizas, sustituir la fuerza por `agility * 0.7 + strength * 0.3` en el término de escalado.

**Daño base actual por arma** (valores en `catalog.ts`, ajustados por balance):

| Arma                  | Daño | Categoría   | StrengthScale |
| --------------------- | ---- | ----------- | ------------- |
| Puños                 | 6    | rápida      | 60            |
| Chaira                | 6    | rápida      | 60            |
| Puntilla              | 7    | rápida      | 62            |
| Jifero                | 9    | media       | 75            |
| Porra de Corchete     | 10   | media       | 85            |
| Verduguillo           | 10   | larga       | 80            |
| Chuzo de Sereno       | 13   | larga       | 95            |
| Vara de Fresno        | 9    | larga       | 75            |
| Banqueta de Taberna   | 22   | pesada      | 110           |
| Tranca de Portón      | 22   | pesada      | 130           |
| Cascote               | 10   | arrojadiza  | 70            |
| Botija de Vino        | 24   | arrojadiza  | 70            |
| Garrafa de Greda      | 28   | arrojadiza  | 70            |
| Cuchillos de Tiro     | 8    | arrojadiza  | 60            |

> **Motor 6:** la Banqueta pasó de 18 a 22 porque ahora se rompe a menudo; la Botija, de 10 a 24 porque se lanza una sola vez; el Cascote, de 9 a 10 porque ya no es infinito.

> **Nota:** Puños vale 6 (no 3) desde que el nivel 1 empieza sin arma; con 3 el combate se iba a ~37 impactos. Con 6 vuelve a ~21, como cuando había arma por defecto.

### 4.6 Defensa

Resolver en este orden y registrar el evento correspondiente:

1. **Esquiva:** `clamp(17 + defender.agility * 3 - weapon.accuracyBonus, 5, 36)` por ciento.  
   (Era `10 + agility * 2`, tope 40. Ajustado para cumplir objetivo 20–35% fallos. Ver `simulate.ts:345`.)
2. **Bloqueo:** solo si el defensor tiene habilidad o arma con bloqueo. La pasiva **Mano Zurda** da `block: 15%`.
3. **Contraataque — Revire (pasiva):** tras **encajar un golpe** (no tras esquivar), `chance: 20%` de devolver un golpe inmediato. Evento `counter`. Ver `simulate.ts:392-400`.
4. **Contraataque — Arma larga:** las armas de categoría `larga` tienen mayor probabilidad de contraatacar tras esquivar (lógica en `simulate.ts:380-390`).

### 4.7 Gestión de armas

Verificar que estén los cuatro casos y que cada uno emita su evento:

- Sacar un arma del inventario (acción que consume turno). Evento `drawWeapon`.
- Descartar el arma en mano para sacar otra.
- Lanzar el arma en mano: hace daño y el arma queda inutilizable el resto del combate. Evento `throwWeapon`.
- Ser desarmado por el rival: el arma cae y queda inutilizable. Evento `disarm`.
- Sin arma en mano se pelea a puños, siempre disponibles.
- **Arrojadizas con stock (motor 6):** cada una trae `stock` tiros por combate. Con stock 1 (Botija, Garrafa) revienta contra el rival al lanzarse, acierte o no; con más (Cascote 3, Cuchillos 5) se agota al gastar el último. En los dos casos se pierde el resto del combate. Evento `weaponLost` con `reason: 'rota'` (stock 1) o `'agotada'`.
- **Rotura (motor 6):** cada arma de mano tiene `breakChance` (0–100), que se tira en **cada impacto que conecta**; un bloqueo cuenta como impacto y una esquiva no. Si se rompe a mitad de combo, el combo se corta ahí. Evento `weaponLost` con `reason: 'rota'`. Si el golpe tumba al rival, no se tira.

  | Arma | breakChance |
  | --- | --- |
  | Puños, arrojadizas, bichos | 0 |
  | Chaira, Puntilla, Vara de Fresno | 1 |
  | Jifero, Verduguillo | 2 |
  | Porra de Corchete | 4 |
  | Chuzo de Sereno | 5 |
  | Tranca de Portón | 8 |
  | Banqueta de Taberna | 30 |

- Quien se queda a puños con armas encima saca otra en su siguiente acción con peso 60 (frente a 12 cuando ya lleva arma): así llevar varias armas paga.

### 4.8 Mascotas

Al obtener una mascota, el luchador **pierde resistencia** (y por lo tanto vida): el coste está en `enduranceCost` de cada mascota (`catalog.ts`):

| Mascota | HP  | Daño | Precisión | Intervalo | Agilidad | **EnduranceCost** |
| ------- | --- | ---- | --------- | --------- | -------- | ----------------- |
| Chucho  | 26  | 5    | 6         | 80        | 5        | **2**             |
| Mastín  | 46  | 9    | 2         | 105       | 2        | **3**             |
| Jabalí  | 72  | 17   | -2        | 130       | 0        | **6**             |

Mínimo 0. La vida base de 30 no se ve afectada, solo la parte que viene de la resistencia.

### 4.9 Habilidades — Motor 5 (pasivas de disparo)

A partir de ENGINE_VERSION 5, las pasivas no son bonus estáticos sino **disparos condicionales** que se arman/gastan durante el combate. Ver `simulate.ts` y `catalog.ts`:

| Habilidad         | Tipo    | Efecto (resumen)                                                                 |
| ----------------- | ------- | -------------------------------------------------------------------------------- |
| **Cuero Curtido** | pasiva  | Una vez por combate, el golpe que la tumbaría la deja con 1 de vida (`lastStand`). |
| **Callo Viejo**   | pasiva  | **Cada impacto** que encaja resta 2 de daño (`armor: 2`). Antes: solo el primero. |
| **Pies Ligeros**  | pasiva  | Tras esquivar, el siguiente ataque no se esquiva y suma +15 al combo (`afterDodge`). |
| **Brazo de Fragua** | pasiva | El primer golpe que conecta pega x2 (`firstBlow: 2`).                            |
| **Resuello**      | pasiva  | Al bajar del 30% de vida, suma +12 de velocidad el resto del combate (`secondWind`). |
| **Mano Zurda**    | pasiva  | 15% de bloquear un impacto (`block: 15`).                                        |
| **Revire**        | pasiva  | 20% de contraatacar **tras encajar un golpe** (`counter: 20`).                   |

**Activas (una vez por combate):**

| Habilidad    | Efecto                                      |
| ------------ | ------------------------------------------- |
| Trago Largo  | Cura 50% de la vida perdida (`heal: 50`).   |
| Zurriagazo   | El siguiente golpe pega x2 (`power: 2`).    |
| Desjarrete   | **Quita el turno al rival, lo desarma y pega un golpe** (`disarm` + daño + salto de turno). Ver `simulate.ts:479-495`. |

### 4.10 Desarme (Desjarrete)

La habilidad **Desjarrete** (activa) hace tres cosas en un solo uso:
1. El rival pierde su próximo turno (se salta su acción en la cola de iniciativa).
2. El arma del rival cae y queda inutilizable (evento `disarm`).
3. El usuario ejecuta un golpe inmediato con su arma actual.

Ver `simulate.ts:479-495`.

---

## 5. Ritmo de la animación

El motor no debe conocer milisegundos. Cada evento lleva un campo `t` en unidades de intervalo, y el reproductor convierte a tiempo real con una constante única, `TIME_SCALE`, ajustable en un solo lugar.

Duraciones de referencia en el cliente:

| Acción                             | Duración |
| ---------------------------------- | -------- |
| Acercarse al rival                 | 300 ms   |
| Golpe (impacto en el frame medio)  | 400 ms   |
| Impacto adicional de un combo      | 250 ms   |
| Esquiva                            | 300 ms   |
| Bloqueo                            | 350 ms   |
| Contraataque                       | 450 ms   |
| Sacar o cambiar arma               | 400 ms   |
| Lanzar arma (vuelo incluido)       | 500 ms   |
| Retroceder a la posición de espera | 300 ms   |
| Muerte                             | 800 ms   |

Reglas de reproducción:

- Nunca se anima un acercamiento antes de un combo: los impactos encadenados ocurren en la misma posición, sin retroceder entre ellos.
- Entre acciones de luchadores distintos siempre hay al menos 150 ms de respiro.
- Los números de daño flotan sobre el defensor 600 ms.
- Con velocidad x2 se escala `TIME_SCALE`, no cada duración por separado.

---

## 6. Criterios de aceptación

El script `pnpm balance` debe extenderse para medir y reportar todas las métricas de la sección 3, y fallar si alguna queda fuera de rango.

Tests nuevos en `packages/engine`:

- Un combo nunca supera 3 impactos.
- El daño de cada impacto adicional es menor que el del anterior.
- Ningún evento ocurre después del evento `end`.
- La suma de daño recibido por cada luchador coincide con la diferencia entre su vida inicial y final.
- Simulando 10.000 combates nivel 1: ninguna categoría de arma supera 60% de victorias, y ninguna baja de 40%.
- El orden de primer golpe se reparte cerca del 50/50 entre los dos lados a lo largo de muchas semillas.
- Las pasivas de disparo se arman/gastan correctamente (Cuero Curtido una vez, Resuello al cruzar umbral, Pies Ligeros tras esquiva, Brazo de Fragua primer golpe, Revire tras encajar).
- Desjarrete quita turno, desarma y pega en la misma acción.

Test del cliente:

- Reproducir un combate con combos, lanzamiento de arma, desarme, contraataque (Revire y arma larga) y muerte, y verificar que no queda ninguna animación sin mapear.

---

## 7. Cómo trabajar esto

1. Implementar primero 4.1, 4.3 y 4.4 (vida, intervalo, iniciativa), que cambian el ritmo base.
2. Correr el script de balance y anotar las métricas de la sección 3 **antes** de seguir.
3. Implementar 4.2 (combos) y volver a medir.
4. Ajustar las constantes de intervalo y daño hasta entrar en los rangos objetivo. Tocar una constante a la vez y volver a medir.
5. Al final, actualizar la sección 6 de `PLAN.md` con los valores definitivos.

Si un objetivo de la sección 3 resulta inalcanzable sin romper otro, reportarlo con los números medidos en vez de forzar el ajuste.