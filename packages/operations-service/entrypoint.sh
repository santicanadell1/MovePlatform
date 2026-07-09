#!/bin/sh
set -e

echo "Running database migrations..."
packages/operations-service/node_modules/.bin/prisma migrate deploy --schema=./packages/operations-service/prisma/schema.prisma

echo "Starting operations-service..."
exec node packages/operations-service/dist/server.js
