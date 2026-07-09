FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_API_URL=http://localhost:8000
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_API_URL=$VITE_API_URL

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/frontend-geo/package.json ./packages/frontend-geo/
RUN pnpm install --filter @move/frontend-geo
COPY packages/frontend-geo ./packages/frontend-geo/
COPY tsconfig.base.json ./
WORKDIR /app/packages/frontend-geo
RUN pnpm build

FROM nginx:alpine
COPY packages/frontend-geo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/frontend-geo/dist /usr/share/nginx/html
EXPOSE 80
