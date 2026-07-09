FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app

# Instalar dependencias (todos los package.json para que pnpm resuelva el workspace completo)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/booking-service/package.json ./packages/booking-service/
COPY packages/operations-service/package.json ./packages/operations-service/
COPY packages/tracking-service/package.json ./packages/tracking-service/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/booking-service/ ./packages/booking-service/
RUN pnpm --filter @move/shared build
RUN pnpm --filter @move/booking-service prisma:generate
RUN pnpm --filter @move/booking-service build
RUN pnpm exec tsc -p packages/booking-service/tsconfig.scripts.json

# Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/booking-service/package.json ./packages/booking-service/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/booking-service/dist ./packages/booking-service/dist
COPY --from=builder /app/packages/booking-service/src/generated ./packages/booking-service/dist/generated
COPY --from=builder /app/packages/booking-service/src/generated ./packages/booking-service/dist/src/generated
COPY packages/booking-service/prisma ./packages/booking-service/prisma
COPY packages/booking-service/prisma/categories.csv ./packages/booking-service/dist/prisma/categories.csv
COPY packages/booking-service/entrypoint.sh ./entrypoint.sh

RUN addgroup -S move && adduser -S move -G move && chown -R move:move /app
USER move

EXPOSE 3001
CMD ["sh", "entrypoint.sh"]
