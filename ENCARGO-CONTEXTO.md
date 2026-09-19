# ENCARGO-CONTEXTO.md — extraer el contexto del repo para el trabajo de diseño

Claude Code: lee este archivo y produce **un solo documento nuevo** en `docs/CONTEXTO-DISENO.md`. No cambies código en esta tarea. El documento se va a copiar y pegar completo en otra conversación, así que tiene que bastarse solo.

## Para qué es

Dos objetivos concretos:

1. **Elaborar más los personajes.** Hoy hay 2 torsos, 2 cabezas y 4 pelos. Se quiere más variedad (caras, barbas, cicatrices, complexiones, accesorios) sin romper el rig ni el determinismo. Para proponer eso hace falta saber exactamente qué campos trae `Appearance`, con qué rangos, y cómo se reparten hoy.
2. **Cerrar el diseño de la interfaz contra el código que ya existe**, para que los tokens y las pantallas se definan una sola vez y calcen con lo que hay.

## Reglas de salida

- Formato Markdown, en español, con tablas donde corresponda.
- **Valores exactos, no descripciones.** "las armas tienen daño variable" no sirve; la tabla completa de armas sí.
- **Nada inventado.** Si algo no existe, escribe `(no existe)`. Si no lo encuentras, `(no encontrado)`. Nunca completes un hueco con lo que parecería razonable.
- **Nada de volcados de código.** Firmas de tipos y valores de datos, sí. Cuerpos de funciones, no, salvo que un fragmento de menos de 15 líneas sea la única forma de explicar algo.
- Apunta las rutas de archivo de cada cosa, para poder volver a ellas.
- Objetivo de extensión: menos de 600 líneas. Si se pasa, recorta primero la sección 7 y luego la 6.
- Si encuentras contradicciones entre `PLAN.md`, `docs/COMBATE.md` y el código, gana el código: anota la discrepancia en la sección 8.

## Secciones que debe tener `docs/CONTEXTO-DISENO.md`

### 1. Mapa del proyecto

Estructura real de carpetas hasta dos niveles. Versiones de Node, React, Pixi, Fastify, Prisma. Comandos de `package.json` que se usan a diario. Fase del plan en la que está cada parte.

### 2. Apariencia del personaje

- La definición completa de `Appearance`: cada campo, su tipo y el **rango exacto** de valores que puede tomar.
- Cómo se deriva del nombre: qué función la genera, qué entra al PRNG, y si se guarda en la base de datos o se recalcula.
- Inventario de piezas dibujadas en `apps/web/src/art/parts.ts`: cuántas variantes hay por cada parte y cuáles campos de `Appearance` las eligen.
- **Cuántos valores de cada campo quedan hoy sin dibujo propio** por el módulo de `pickFrom` (p. ej. si `appearance.head` va de 0 a 7 pero solo hay 2 cabezas). Este número es el que interesa.
- Las paletas completas, con sus hex, tal como están en el archivo.
- El rig: lista de partes, de quién cuelga cada una y en qué coordenada. Si hay partes del rig fuera de `Z_ORDER`, decir cuáles y por qué.
- Sistema de coordenadas y tamaño del personaje en unidades.

### 3. Animaciones

Lista de animaciones en `poses.ts` con su nombre, duración y qué partes mueve cada una. Cómo se eligen desde los eventos del combate. Qué eventos del motor todavía no tienen animación asignada.

### 4. Motor de combate

- Las cuatro estadísticas y sus rangos observados en nivel 1 y en nivel 10.
- Fórmulas vigentes en el código (vida, daño, intervalo, esquiva, combo), copiadas tal cual de las constantes, no del plan.
- **Catálogo completo de armas** en una tabla: id, nombre visible, categoría, daño, intervalo, precisión, tasa de combo, alcance, si es arrojadiza, y cualquier otro campo que exista.
- **Catálogo completo de habilidades**: id, nombre visible, tipo, efecto en una línea.
- **Catálogo completo de mascotas**: id, nombre visible, estadísticas, penalización que aplican al luchador.
- Reglas de progresión reales: XP por combate, umbral por nivel, cómo se generan las dos opciones, peleas diarias.
- Últimos resultados del script de balance, si existen.

### 5. Interfaz actual

- Todas las rutas de React con su archivo y qué muestra cada una.
- Por cada pantalla: si ya tiene diseño propio o si sigue en el "mínimo funcional" de la fase 3.
- Dónde viven los estilos hoy (CSS, módulos, utilidades, estilos en línea) y si existe algún archivo de tokens.
- Qué componentes son reutilizados entre pantallas.
- Cómo se resuelve el responsive hoy y qué breakpoints hay, si los hay.
- El caso del ranking: cómo está construida la tabla y qué columnas tiene.

### 6. Datos que llegan a cada pantalla

Para la ficha del luchador, la arena, el ranking y la repetición de combate: qué campos exactos devuelve la API y llegan al componente. Los nombres reales de los campos importan. Anota también lo que la pantalla muestra hoy pero no viene de la API.

### 7. Textos

Los textos de interfaz que ya existen, tal cual están escritos, agrupados por pantalla. Si hay algún sistema de traducción, decirlo.

### 8. Discrepancias y deuda

- Diferencias entre lo que dicen `PLAN.md` y `docs/COMBATE.md` y lo que hace el código.
- Cosas a medio hacer, comentarios `TODO`, tests saltados.
- Decisiones tomadas durante la implementación que no quedaron escritas en ningún documento.

### 9. Restricciones para el trabajo de diseño

Cualquier límite que deba respetar quien diseñe la interfaz: nombres de partes o pivotes que el rig requiere, formatos que el reproductor de combate espera, tamaños fijos, cosas que romperían los tests si cambian.

## Al terminar

Escribe al final del documento una lista corta de **preguntas abiertas**: lo que no pudiste determinar leyendo el repo y que conviene que decida una persona.
