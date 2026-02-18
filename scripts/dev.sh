#!/bin/bash

# Team Agent Dashboard - Development Server
# Starts both frontend (Vite) and backend (Hono) concurrently

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Ensure data directory exists for SQLite
mkdir -p data

# Run both servers
exec npx concurrently \
  -n dashboard,server \
  -c blue,green \
  "npm run dev -w dashboard" \
  "npm run dev -w server"
