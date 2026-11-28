# Novedades: release notes para testers y comunidad

**Fecha:** 2026-11-28 · **Tamaño:** cambio chico (diseño corto)

## Para qué

Que quien entra a pelear sepa qué cambió desde la última vez y, si algo no le convence, lo
reporte. Lo mismo, para la comunidad de fuera, como release de GitHub.

## Enfoques considerados

- **A. Archivo escrito a mano en el repo, fuente de las dos cosas (elegido).** Texto para
  jugador, una sola fuente, el typecheck lo valida. Cuesta escribir unas líneas por despliegue.
- B. Generar desde los commits (git-cliff, release-please): sin trabajo, pero el texto sale
  técnico y mezcla cambios internos. No sirve para jugadores.
- C. GitHub Releases como fuente, leídas por el sitio: el sitio pasaría a depender de la API de
  GitHub (límites, caídas) para mostrar un texto que cambia una vez por despliegue.

Las notas automáticas de GitHub se arman con PRs fusionados entre tags, y este repo no tiene
ni tags ni PRs: saldrían vacías.

## Diseño

- `apps/web/src/novedades.ts`: lista de entradas, de la más nueva a la más vieja. Cada entrada
  tiene `fecha` (ISO `YYYY-MM-DD`, que hace de id: única) y `puntos`, cada uno con
  `tipo: 'nuevo' | 'cambio' | 'arreglo'` y `texto` (para jugador, con tildes).
- Página `/novedades`: todas las entradas, más nueva primero, con la etiqueta de tipo; al final
  "¿Algo no te convence?" y el botón de reportar que ya existe.
- Barra superior: enlace "Novedades" entre Ranking y Reportar, con un punto mientras no se haya
  visto la entrada más reciente. Visitar la página lo apaga. La última fecha vista va en
  `localStorage` (`camorra:novedades-vista`); sin almacén el punto sale siempre y nada se rompe.
  Los jugadores nuevos también ven el punto la primera vez.
- Comunidad: `pnpm --filter @camorra/web novedades` imprime la última entrada en Markdown;
  con eso, `gh release create v<fecha con puntos> --notes-file -`. Tags por fecha. Crear el
  release lo hace Kevin, o Claude cuando se lo pida: sale de la máquina.

## Fuera de alcance

Correo o notificaciones, historial por jugador, panel para escribirlas.

## A criterio del que construye

Estilos (con los tokens existentes), formato de fecha, redacción de la primera entrada (que
Kevin revisa antes de commitear).

## Riesgos

- Si lo desplegado es anterior al motor 6, la primera entrada cubre armas que se gastan, armas
  nuevas, curva de experiencia y los dos arreglos visuales; si no, se recorta.
- Dos despliegues el mismo día comparten entrada.
