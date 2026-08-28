#!/usr/bin/env node
/**
 * 上传所有 HTML 页面并生成导航页面
 */

const { S3Storage } = require('coze-coding-dev-sdk');
const fs = require('fs');
const path = require('path');

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

async function uploadFile(filePath, fileName) {
  const fileContent = fs.readFileSync(filePath);
  const key = await storage.uploadFile({
    fileContent,
    fileName,
    contentType: 'text/html',
  });
  return key;
}

async function main() {
  const outDir = path.join(__dirname, '../out');
  
  // 上传所有 HTML 页面
  const pages = ['index.html', 'room.html', 'streamer.html', 'yearly.html'];
  const uploadedPages = [];
  
  for (const page of pages) {
    const filePath = path.join(outDir, page);
    if (fs.existsSync(filePath)) {
      const key = await uploadFile(filePath, `meimei-dashboard/${page}`);
      const url = await storage.generatePresignedUrl({
        key,
        expireTime: 31536000, // 1 年
      });
      uploadedPages.push({ name: page, url });
      console.log(`✅ 上传：${page}`);
    }
  }
  
  // 创建导航页面
  const navHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>美魅数据大屏</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e2e8f0;
    }
    .container {
      max-width: 800px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 40px;
      background: linear-gradient(90deg, #00d4ff, #10b981);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .nav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .nav-card {
      background: rgba(20, 20, 35, 0.8);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      text-decoration: none;
      color: #e2e8f0;
      transition: all 0.3s ease;
    }
    .nav-card:hover {
      border-color: #00d4ff;
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
    }
    .nav-card h3 {
      font-size: 1.2rem;
      margin-bottom: 10px;
      color: #00d4ff;
    }
    .nav-card p {
      font-size: 0.9rem;
      color: #94a3b8;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #64748b;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>美魅数据大屏</h1>
    <div class="nav-grid">
      <a href="${uploadedPages[0]?.url || '#'}" class="nav-card">
        <h3>数据总览</h3>
        <p>当月汇总、当日排名、预警面板</p>
      </a>
      <a href="${uploadedPages[1]?.url || '#'}" class="nav-card">
        <h3>直播间分析</h3>
        <p>分直播间筛选、主播排名</p>
      </a>
      <a href="${uploadedPages[2]?.url || '#'}" class="nav-card">
        <h3>主播分析</h3>
        <p>分主播筛选、历史趋势</p>
      </a>
      <a href="${uploadedPages[3]?.url || '#'}" class="nav-card">
        <h3>年度数据</h3>
        <p>年度汇总、按月趋势</p>
      </a>
    </div>
    <div class="footer">
      <p>数据更新：2026.8.27 | 链接有效期：1 年</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  // 先写入导航页面文件
  const navFilePath = path.join(__dirname, '../nav.html');
  fs.writeFileSync(navFilePath, navHtml);
  
  // 上传导航页面
  const navKey = await uploadFile(navFilePath, 'meimei-dashboard/nav.html');
  const navUrl = await storage.generatePresignedUrl({
    key: navKey,
    expireTime: 31536000,
  });
  
  console.log(`\n 导航页面链接：${navUrl}`);
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
