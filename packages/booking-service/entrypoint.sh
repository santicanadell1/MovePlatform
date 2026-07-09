#!/bin/sh
set -e

echo "Running database migrations..."
packages/booking-service/node_modules/.bin/prisma migrate deploy --schema=./packages/booking-service/prisma/schema.prisma

echo "Seeding privileged users..."
node packages/booking-service/dist/scripts/seed-privileged-users.js

echo "Seeding categories..."
node packages/booking-service/dist/scripts/seed-categories.js

echo "Generating category embeddings..."
node packages/booking-service/dist/scripts/seed-embeddings.js

echo "Starting booking-service..."
exec node packages/booking-service/dist/server.js
