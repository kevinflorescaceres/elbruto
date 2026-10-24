#!/usr/bin/env bash
# Stop: en modo autonomo no deja terminar con lint, tipos o tests en rojo.
#
# Solo actua con AUTONOMO=1, que pone .claude/autonomo.sh. En una sesion normal
# serian 20 s de verificacion despues de cada respuesta.
#
# Da una oportunidad de arreglarlo. En el segundo intento (stop_hook_active) lo
# deja terminar: el script repite la verificacion, con e2e, y descarta la tarea si
# sigue en rojo. Bloquear siempre deja al agente en bucle gastando cuota.

set -uo pipefail

[ "${AUTONOMO:-}" = 1 ] || exit 0
[ "$(jq -r '.stop_hook_active // false')" = true ] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
SALIDA=$( { pnpm lint && pnpm typecheck && pnpm test; } 2>&1 ) && exit 0

echo "La verificacion falla. Arreglalo antes de terminar, o marca la tarea [!] con el motivo." >&2
printf '%s\n' "$SALIDA" | tail -40 >&2
exit 2
