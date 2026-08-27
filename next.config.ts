import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 静态导出配置（用于 Gitee Pages）
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 导出时不包含 API 路由（静态页面不需要）
};

export default nextConfig;
