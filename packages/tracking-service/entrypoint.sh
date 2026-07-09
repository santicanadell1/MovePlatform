#!/bin/sh
set -e

echo "Running database migrations..."
packages/tracking-service/node_modules/.bin/prisma migrate deploy --schema=./packages/tracking-service/prisma/schema.prisma

echo "Starting tracking-service..."
exec node packages/tracking-service/dist/server.js
