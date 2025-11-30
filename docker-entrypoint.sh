#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma@5.22.0 db push --accept-data-loss --skip-generate

echo "Starting Next.js server..."
exec node server.js