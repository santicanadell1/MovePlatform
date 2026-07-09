FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/booking-service/package.json ./packages/booking-service/
COPY packages/operations-service/package.json ./packages/operations-service/
COPY packages/tracking-service/package.json ./packages/tracking-service/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/tracking-service/ ./packages/tracking-service/
RUN pnpm --filter @move/shared build
RUN pnpm --filter @move/tracking-service prisma:generate
RUN pnpm --filter @move/tracking-service build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
RUN npm install -g pnpm
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/tracking-service/package.json ./packages/tracking-service/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/tracking-service/dist ./packages/tracking-service/dist
COPY --from=builder /app/packages/tracking-service/src/generated ./packages/tracking-service/dist/generated
COPY packages/tracking-service/prisma ./packages/tracking-service/prisma
COPY packages/tracking-service/entrypoint.sh ./entrypoint.sh

RUN addgroup -S move && adduser -S move -G move && chown -R move:move /app
USER move

EXPOSE 3003
CMD ["sh", "entrypoint.sh"]
