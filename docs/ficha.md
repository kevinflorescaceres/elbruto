---
nombre: Camorra
slug: elbruto
actualizado: 2026-10-22
estado: prototipo   # idea | prototipo | en-uso | pausado | archivado
---

# Camorra

## Resumen
Juego web multijugador asíncrono de peleas automáticas inspirado en El Bruto: creas un peleón solo con un nombre, combate solo contra los de otros jugadores y subes de nivel eligiendo mejoras. Público, sin registro (acceso por URL y cookie).

## Origen
- Repo / carpeta: carpeta local `~/code/elbruto` (sin remoto git configurado)
- Chat de origen (título o enlace): https://claude.ai/chat/b3cf551c-ee2d-475f-a73d-57a578a588cb
- Creada con: chat (luego Claude Code)

## Stack
- Lenguaje / framework: TypeScript sobre Node 22 / Fastify 5 (monorepo pnpm: `@camorra/engine`, `@camorra/shared`, `@camorra/server`, `@camorra/web`)
- Base de datos: PostgreSQL (16 en local/CI; Supabase en producción) vía Prisma 7
- Frontend: React 19 + Vite 7, PixiJS 8 y GSAP para el combate, CSS propio sin framework
- Gems / paquetes clave: fastify, @fastify/rate-limit, @fastify/cookie, @fastify/static, prisma 7.10.0 + @prisma/adapter-pg, zod 4, @tanstack/react-query, react-router, pixi.js, gsap, tsx; vitest y playwright para pruebas

## Requisitos de runtime
- Background jobs: no
- Cron / tareas programadas: no (el límite diario se calcula con `GAME_TIMEZONE`, sin tareas programadas)
- Almacenamiento de archivos: no
- WebSockets / Action Cable: no
- Correo saliente: no
- Consumo estimado (RAM/CPU): bajo (Fly `shared-cpu-1x`, 512 MB, escala a cero)
- Tráfico esperado: público

## Configuración
- Variables de entorno (SOLO nombres, nunca valores): `DATABASE_URL`, `DIRECT_URL`, `PORT`, `PUBLIC_URL`, `TRUST_PROXY`, `GAME_TIMEZONE`, `NODE_ENV`, `BLOCKED_NAMES_EXTRA` (opcional); solo desarrollo/pruebas: `TEST_DATABASE_URL`, `PRISMA_TARGET`
- Credentials / master key (dónde se guarda, no el valor): `DATABASE_URL` y `DIRECT_URL` como secretos de Fly (`fly secrets set`); en local, `.env` en la raíz (ignorado por git)
- Servicios externos / APIs: Supabase (PostgreSQL: pooler para la app, conexión directa para migraciones)
- Dominio o subdominio deseado: camorra.florescaceres.cl

## Despliegue
- Estado: sin desplegar
- Plataforma: Fly.io (región `scl`) + Supabase
- URL: aún no hay
- Método: PaaS (Fly.io con el `Dockerfile` del repo)
- Comando o pasos de deploy: `fly launch --no-deploy` → `fly secrets set DATABASE_URL=... DIRECT_URL=...` → `fly deploy`. Las migraciones (`prisma migrate deploy`) corren al arrancar el contenedor.
- Backups: no configurado
- Problemas conocidos: el rate limit vive en memoria de cada máquina (se reinicia en cada arranque en frío y es por máquina); `prisma migrate` falla si `DIRECT_URL` apunta al pooler.

## Pendientes antes de desplegar
- [ ] Verificar "Camorra" contra el registro de marcas (plan.md §11)
- [ ] Poner una dirección real en `CORREO_DE_CONTACTO_PENDIENTE` (`apps/web/src/pages/Legal.tsx`)
- [ ] Crear la cuenta de Fly.io y el proyecto de Supabase, y cargar los secretos
- [ ] Apuntar camorra.florescaceres.cl a Fly y cambiar `PUBLIC_URL` en `fly.toml` a ese dominio (se usa en `og:url`)
- [ ] Configurar backups de la base de datos
