#!/bin/bash
set -e

echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "Fetching data from Feishu..."
node scripts/fetch-from-doc.js

echo "Building static site..."
npx next build
npx next export
