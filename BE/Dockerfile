# Multi-stage build for API and worker (same artifact, different CMD).
# Production deploy is out of S0-03 scope; image supports local smoke and S7 later.

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json nest-cli.worker.json tsconfig.json tsconfig.worker.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
