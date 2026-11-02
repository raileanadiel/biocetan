# Portal image for the owner's VM (driverschat-vm), where every app runs in Docker behind the
# shared Caddy container. Built on the VM itself: `docker compose up -d --build` (see README).
# Debian slim, not Alpine: libsql ships glibc binaries.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4322 DATABASE_URL=file:/data/portal.db
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts ./scripts
# The database (and its backups) live in /data, a named volume; nothing else is writable.
RUN install -d -o node -g node /data
USER node
VOLUME /data
EXPOSE 4322
# Migrations run before every start, so a new image also brings the schema up to date.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node dist/server/entry.mjs"]
