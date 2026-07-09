FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/booking-service/package.json ./packages/booking-service/
COPY packages/operations-service/package.json ./packages/operations-service/
COPY packages/tracking-service/package.json ./packages/tracking-service/
COPY packages/ai-worker/package.json ./packages/ai-worker/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY packages/ai-worker/ ./packages/ai-worker/
RUN pnpm --filter @move/shared build
RUN pnpm --filter @move/ai-worker build

FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai-worker/package.json ./packages/ai-worker/
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/ai-worker/dist ./packages/ai-worker/dist

RUN addgroup -S move && adduser -S move -G move && chown -R move:move /app
USER move

CMD ["node", "packages/ai-worker/dist/index.js"]
