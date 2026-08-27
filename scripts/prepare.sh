#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "Installing dependencies..."
pnpm install --no-frozen-lockfile

echo "Dependencies installed successfully."
