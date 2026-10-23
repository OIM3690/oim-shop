# The v3 app in one image: the API, the built web app, the migrations and the
# seed. Built in GitHub Actions for linux/amd64 and pulled by the server.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build --workspace web

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
# Only the API's runtime packages; the web app is already built.
RUN npm ci --omit=dev --workspace api && npm cache clean --force
COPY api/src api/src
COPY db db
COPY data/seed data/seed
COPY --from=build /app/web/dist web/dist
USER node
ENV DATABASE_PATH=/data/shop.db \
    WEB_DIST=/app/web/dist \
    HOST=0.0.0.0 \
    PORT=8787
EXPOSE 8787
# A first start seeds the database on the /data volume; later starts reuse it.
CMD ["sh", "-c", "[ -f \"$DATABASE_PATH\" ] || node api/src/cli/seed.ts && exec node --max-old-space-size=${NODE_HEAP_MB:-96} api/src/server.ts"]
