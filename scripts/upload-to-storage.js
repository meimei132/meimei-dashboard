#!/usr/bin/env node
/**
 * 上传静态站点到对象存储
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

async function uploadDirectory(dirPath, prefix = '') {
  const files = fs.readdirSync(dirPath);
  const uploadedFiles = [];
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      const subFiles = await uploadDirectory(filePath, path.join(prefix, file));
      uploadedFiles.push(...subFiles);
    } else {
      const fileContent = fs.readFileSync(filePath);
      const fileName = path.join(prefix, file);
      
      // 获取 MIME 类型
      const ext = path.extname(file).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      try {
        const key = await storage.uploadFile({
          fileContent,
          fileName,
          contentType,
        });
        uploadedFiles.push({ fileName, key });
        console.log(`✅ 上传：${fileName}`);
      } catch (error) {
        console.error(`❌ 上传失败：${fileName} - ${error.message}`);
      }
    }
  }
  
  return uploadedFiles;
}

async function main() {
  const outDir = path.join(__dirname, '../out');
  
  if (!fs.existsSync(outDir)) {
    console.error('错误：out 目录不存在，请先运行 pnpm build');
    process.exit(1);
  }
  
  console.log('开始上传静态站点...\n');
  
  const uploadedFiles = await uploadDirectory(outDir, 'meimei-dashboard');
  
  console.log(`\n总计上传 ${uploadedFiles.length} 个文件`);
  
  // 生成主页面的签名 URL（有效期 1 年）
  const indexFile = uploadedFiles.find(f => f.fileName === 'meimei-dashboard/index.html');
  if (indexFile) {
    const url = await storage.generatePresignedUrl({
      key: indexFile.key,
      expireTime: 31536000, // 1 年
    });
    console.log(`\n 访问链接（有效期 1 年）：${url}`);
  }
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
