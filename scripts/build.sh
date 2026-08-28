#!/bin/bash
set -e

echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "Building static site..."
npx next build
