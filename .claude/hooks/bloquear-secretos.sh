#!/usr/bin/env bash
# PreToolUse sobre Edit|Write.
#
# Bloquea la escritura en archivos con credenciales. Una linea en CLAUDE.md es una
# peticion; esto es una garantia, y en modo autonomo no hay nadie mirando.
#
# Salida 2 = bloquea la operacion y le muestra el mensaje a Claude.

set -uo pipefail

RUTA=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$RUTA" ] && exit 0

case "$(basename "$RUTA")" in
  .env.example) exit 0 ;;
  .env|.env.*|*.key|*.pem|*.p12)
    echo "Bloqueado: '$(basename "$RUTA")' guarda credenciales y no se edita desde aqui." >&2
    echo "Si hace falta una variable nueva, anotala en .env.example y avisa en el reporte." >&2
    exit 2
    ;;
esac

exit 0
