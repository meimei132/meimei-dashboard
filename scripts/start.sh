#!/bin/bash
export PORT=${DEPLOY_RUN_PORT:-5000}

# 如果 out 目录不存在，先构建
if [ ! -d "out" ]; then
  echo "Building static site..."
  bash ./scripts/build.sh
fi

# 使用 npx serve 托管静态文件
npx serve out -l $PORT
