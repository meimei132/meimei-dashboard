#!/bin/bash
export PORT=${DEPLOY_RUN_PORT:-5000}

# 如果 node_modules 不存在，先安装依赖
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install --no-frozen-lockfile
fi

npx next dev -p $PORT
