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
- **Cada nivel da +1.5 de vida**, independiente de la resistencia.
- La resistencia puede ser 0. La vida mínima posible de un luchador es 51.
- En la práctica un luchador nivel 1 tiene alrededor de **63 de vida** (base 50 + unos 2 puntos de resistencia).

La fórmula actual del proyecto (`50 + endurance * 6`) es correcta. **Falta agregar el término por nivel.**

```
maxHp = floor(50 + endurance * 6 + level * 1.5)
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

## 4. Cambios a implementar en el motor

### 4.1 Vida

Agregar el término `level * 1.5` a `maxHp` y truncar hacia abajo. Actualizar los snapshots existentes no es necesario: los combates guardados conservan su propio snapshot.

### 4.2 Combos

Nuevo mecanismo en la resolución de un ataque. Tras un impacto exitoso, tirar de nuevo:

```
comboChance = weapon.comboRate + agility * 2   // en porcentaje
comboChance = clamp(comboChance, 0, 45)
```

- Máximo 3 impactos por acción.
- Cada impacto adicional hace **70% del daño** del anterior.
- Cada impacto adicional se tira de nuevo contra la misma probabilidad.
- Cada impacto genera su propio evento `hit` + `damage`, para que el cliente pueda animar la secuencia.
- `comboRate` por categoría: rápida 20, media 10, pesada 0, larga 5, arrojadiza 0.

### 4.3 Intervalo y turnos consecutivos

Sustituir el cálculo actual de retardo por:

```
delay = round(weapon.interval * 100 / (10 + speed))
```

- `interval` por categoría (valores de partida): rápida 55, media 80, larga 95, pesada 140, arrojadiza 70, puños 60.
- Efecto buscado: con velocidad 3 y arma rápida, el luchador acumula rachas de 2 a 4 acciones seguidas. Verificarlo con el script de balance, no a ojo.

### 4.4 Iniciativa inicial

Al comenzar el combate, el tiempo inicial de cada luchador se sortea con el PRNG en un rango pequeño en vez de empezar ambos en 0, para que el primer golpe no sea siempre del mismo lado.

### 4.5 Daño

```
base    = weapon.damage + floor(strength * weapon.strengthScale / 100)
variado = base * rand(80, 120) / 100
final   = max(1, variado - defender.armor)
```

Para armas arrojadizas, sustituir la fuerza por `agility * 0.7 + strength * 0.3` en el término de escalado.

Daño base por categoría (valores de partida): puños 3, rápida 5, media 9, larga 10, pesada 20, arrojadiza 7.

### 4.6 Defensa

Resolver en este orden y registrar el evento correspondiente:

1. **Esquiva:** `clamp(10 + defender.agility * 2 - weapon.accuracyBonus, 5, 40)` por ciento.
2. **Bloqueo:** solo si el defensor tiene habilidad o arma con bloqueo.
3. **Contraataque:** si el defensor lleva arma larga o habilidad de contra, tras esquivar puede devolver un golpe inmediato. Evento `counter`.

### 4.7 Gestión de armas

Verificar que estén los cuatro casos y que cada uno emita su evento:

- Sacar un arma del inventario (acción que consume turno).
- Descartar el arma en mano para sacar otra.
- Lanzar el arma en mano: hace daño y el arma queda inutilizable el resto del combate.
- Ser desarmado por el rival: el arma cae y queda inutilizable.
- Sin arma en mano se pelea a puños, siempre disponibles.
- Las arrojadizas no se agotan ni se pierden al lanzarse.

### 4.8 Mascotas

Al obtener una mascota, el luchador **pierde resistencia** (y por lo tanto vida): perro -2, lobo -4, oso -8, con mínimo 0. Es el equilibrio del original: la mascota pelea por ti, pero eres más frágil. La vida base de 50 no se ve afectada, solo la parte que viene de la resistencia.

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

Test del cliente:

- Reproducir un combate con combos, lanzamiento de arma, desarme, contraataque y muerte, y verificar que no queda ninguna animación sin mapear.

---

## 7. Cómo trabajar esto

1. Implementar primero 4.1, 4.3 y 4.4 (vida, intervalo, iniciativa), que cambian el ritmo base.
2. Correr el script de balance y anotar las métricas de la sección 3 **antes** de seguir.
3. Implementar 4.2 (combos) y volver a medir.
4. Ajustar las constantes de intervalo y daño hasta entrar en los rangos objetivo. Tocar una constante a la vez y volver a medir.
5. Al final, actualizar la sección 6 de `PLAN.md` con los valores definitivos.

Si un objetivo de la sección 3 resulta inalcanzable sin romper otro, reportarlo con los números medidos en vez de forzar el ajuste.
