# Imagen unica: el servidor Fastify sirve la API y el frontend construido.
# Generica a proposito: vale para Fly.io, Railway o Render sin cambios.
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable pnpm
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @rufianes/server exec prisma generate
RUN pnpm --filter @rufianes/web build
# Sin las dependencias de desarrollo la imagen baja a la mitad; tsx se queda
# porque los paquetes del workspace se publican como TypeScript fuente.
RUN pnpm prune --prod && pnpm --filter @rufianes/server add -D tsx

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable pnpm

COPY --from=build /app /app

EXPOSE 3000
# Las migraciones corren al arrancar: un despliegue nuevo deja la base al dia.
CMD ["sh", "-c", "pnpm --filter @rufianes/server exec prisma migrate deploy && pnpm --filter @rufianes/server start"]
