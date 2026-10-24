#!/usr/bin/env bash
# Trabaja docs/backlog.md sin supervision: una tarea por sesion de `claude -p`,
# con contexto limpio, en la rama auto/AAAA-MM-DD. Nunca toca main ni hace push.
#
#   .claude/autonomo.sh [maximo_de_tareas]     (por defecto 3)
#
# El agente hace la tarea, la marca y la commitea. Este script es la puerta final:
# si la verificacion completa falla, el arbol queda sucio o la tarea no quedo
# marcada, guarda el intento en la rama auto-fallida/<id>-<fecha>, deshace la tarea
# y la marca [!]. Lo que queda en auto/ siempre pasa la verificacion.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

MAXIMO=${1:-3}
FECHA=$(date +%F)
RAMA="auto/$FECHA"
REGISTROS=".autonomo/$FECHA"
BACKLOG=docs/backlog.md

morir() { echo "autonomo: $1" >&2; exit 1; }

[ -z "$(git status --porcelain)" ] || morir "hay cambios sin confirmar; empieza con el arbol limpio"
pg_isready -q || morir "Postgres no responde (sudo service postgresql start)"
[ -f "$BACKLOG" ] || morir "no existe $BACKLOG"

ORIGEN=$(git branch --show-current)
trap 'git switch -q "$ORIGEN"' EXIT
git switch -q "$RAMA" 2>/dev/null || git switch -q -c "$RAMA" main
mkdir -p "$REGISTROS"

verificar() {
  pnpm lint && pnpm typecheck && pnpm test && pnpm balance && pnpm e2e
}

# Lo que el agente puede hacer aqui y no en una sesion normal: commitear sin
# preguntar. El resto lo decide el modo auto con los permisos del repo.
PERMISOS=("Bash(git add *)" "Bash(git commit *)" "Bash(pnpm *)" "Bash(npx playwright *)" Edit Write)

reemplazar_linea() { # id, linea nueva. ENVIRON y no -v: awk -v interpreta las barras
  LINEA_NUEVA="$2" awk -v id="$1" \
    'index($0, "] " id " ") == 5 && !hecho { print ENVIRON["LINEA_NUEVA"]; hecho = 1; next } 1' \
    "$BACKLOG" >"$BACKLOG.tmp" && mv "$BACKLOG.tmp" "$BACKLOG"
}

for _ in $(seq "$MAXIMO"); do
  LINEA=$(grep -m1 -E '^- \[ \] T[0-9]+ ' "$BACKLOG") || { echo "autonomo: no quedan tareas"; break; }
  ID=$(printf '%s' "$LINEA" | awk '{print $4}')
  ANTES=$(git rev-parse HEAD)
  echo "autonomo: $ID"

  AUTONOMO=1 timeout 60m claude -p \
    "Modo autonomo. Haz la tarea $ID de $BACKLOG siguiendo la seccion «Modo autonomo» de CLAUDE.md." \
    --permission-mode auto --permission-prompts none --allowedTools "${PERMISOS[@]}" \
    </dev/null >"$REGISTROS/$ID.md" 2>&1 || true

  LINEA_AGENTE=$(grep -m1 -E "^- \[.\] $ID " "$BACKLOG")
  MARCA=$(printf '%s' "$LINEA_AGENTE" | cut -c4)
  MOTIVO=""
  case "$MARCA" in
    x|\?) ;;
    !) MOTIVO="bloqueada por el agente" ;;
    *) MOTIVO="sin terminar" ;;
  esac
  [ -z "$MOTIVO" ] && [ -n "$(git status --porcelain)" ] && MOTIVO="dejo cambios sin commitear"
  if [ -z "$MOTIVO" ] && ! grep -q "^- \[.\] $ID \[diseño\]" "$BACKLOG" \
     && git diff --name-only "$ANTES" HEAD | grep -q -- '-snapshots/'; then
    MOTIVO="cambio capturas base sin ser tarea de diseño"
  fi
  [ -z "$MOTIVO" ] && ! verificar >"$REGISTROS/$ID-verificacion.log" 2>&1 && MOTIVO="la verificacion falla"

  if [ -z "$MOTIVO" ]; then
    echo "autonomo: $ID [$MARCA]"
    continue
  fi

  # Guarda el intento antes de deshacerlo: nada se pierde, solo sale de auto/.
  git add -A && git commit -q -m "wip($ID): intento descartado, $MOTIVO" --allow-empty
  git branch -f "auto-fallida/$ID-$FECHA" HEAD
  git reset -q --hard "$ANTES"
  # Si el agente la bloqueo, su linea ya trae el motivo; si no, se anota aqui.
  if [ "$MARCA" = "!" ]; then
    reemplazar_linea "$ID" "$LINEA_AGENTE"
  else
    reemplazar_linea "$ID" "- [!] ${LINEA#- \[ \] } — $MOTIVO"
  fi
  git add "$BACKLOG"
  git commit -q -m "chore(backlog): $ID bloqueada"
  echo "autonomo: $ID [!] $MOTIVO (intento en auto-fallida/$ID-$FECHA)"
done

echo "autonomo: revisa git log main..$RAMA y los registros en $REGISTROS"
