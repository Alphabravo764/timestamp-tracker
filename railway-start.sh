#!/bin/sh
# Railway startup script - runs migrations then starts server

echo "Running database migrations..."
pnpm db:push

echo "Starting server..."
NODE_ENV=production node dist/index.js
