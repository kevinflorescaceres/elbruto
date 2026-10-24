# Backlog

Tareas para el modo autónomo (`.claude/autonomo.sh`) y para cualquier sesión. El script
toma la primera `[ ]` de arriba hacia abajo: el orden es la prioridad.

Una tarea cabe en una sesión; si no cabe, se parte. Cada una dice **cuándo está lista**:
sin eso el agente no sabe cuándo parar. Si depende de una decisión tuya, la decisión va
escrita en la tarea, o la tarea no está lista para el backlog.

Marcas: `[ ]` pendiente · `[x]` hecha · `[?]` de diseño, hecha y esperando tu visto bueno ·
`[!]` bloqueada, con el motivo al final de la línea.

`[diseño]` delante del título la manda por `web-designer` → `ux-reviewer` y la deja en `[?]`.
Es la única clase de tarea que puede cambiar las capturas base de `e2e/visual.spec.ts`.

## Pendientes

- [ ] T1 [diseño] Portada a 360 px: pasarla por `ux-reviewer` y corregir los hallazgos críticos. **Lista cuando:** `ux-reviewer` da APPROVED a 360 y 1280, y los textos contrato del e2e (ARTE-Y-TOKENS.md, «Cuidado con esto») siguen iguales.
- [ ] T2 Diseño técnico de los torneos diarios por nivel en `docs/torneos.md`, sin código. **Lista cuando:** el documento cubre modelo de datos, cuándo se juega un torneo sin tareas programadas, API, qué muestra la web y qué cambia en el motor; cada decisión dice por qué, y lo que dependa de mí queda como pregunta al final.
