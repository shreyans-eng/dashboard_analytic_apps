# Analytics dashboard — Express API + Vite SPA + SQL library
# Build from this repo root (needs sql/ + banknote-analytics-dashboard/).
#
#   docker build -t banknote-analytics .
#   docker run --rm -p 3001:3001 --env-file banknote-analytics-dashboard/.env banknote-analytics

FROM node:20-alpine AS build
WORKDIR /app

COPY banknote-analytics-dashboard/package.json banknote-analytics-dashboard/package-lock.json ./
RUN npm ci

COPY banknote-analytics-dashboard/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0 \
    SQL_ROOT=/sql

RUN addgroup -S app && adduser -S app -G app

COPY banknote-analytics-dashboard/package.json banknote-analytics-dashboard/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY banknote-analytics-dashboard/server ./server
COPY --from=build /app/dist ./dist
COPY sql /sql

RUN mkdir -p /app/secrets && chown -R app:app /app /sql

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=8s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
