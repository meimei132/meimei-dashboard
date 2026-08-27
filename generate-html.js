const fs = require('fs');
const path = require('path');

// 读取 mock-data.ts
const mockDataPath = path.join(__dirname, 'src/lib/mock-data.ts');
let content = fs.readFileSync(mockDataPath, 'utf-8');

// 提取 JSON 数据
const match = content.match(/export const mockData: SessionRecord\[\] = (\[[\s\S]*?\]);/);
if (!match) {
    console.error('无法提取数据');
    process.exit(1);
}

const jsonData = match[1];

// 读取 HTML 模板
const htmlPath = path.join(__dirname, 'meimei-dashboard.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// 替换数据
html = html.replace('const mockData = [', 'const mockData = ' + jsonData);

// 保存
const outputPath = path.join(__dirname, 'meimei-dashboard-full.html');
fs.writeFileSync(outputPath, html);

console.log('生成完成：', outputPath);
console.log('文件大小：', (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2), 'MB');
