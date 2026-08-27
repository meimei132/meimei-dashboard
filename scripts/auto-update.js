// 自动更新脚本
// 每天定时运行：抓取飞书数据 → 构建 → 上传到 Cloudflare Pages → 清除缓存

const { execSync } = require('child_process');
const path = require('path');

// Cloudflare 配置
const CF_API_TOKEN = 'cfut_VYfBiXuTNfAe7fM5KDSYnClTMfJlaiWBarE21e645fd8c37b';
const CF_ACCOUNT_ID = '8cb927429a6eab248975e864c049b8cd';
const CF_PROJECT_NAME = 'meimei-dashboard';

async function main() {
  console.log('开始自动更新...', new Date().toISOString());
  
  try {
    // 1. 运行飞书数据抓取脚本
    console.log('1. 抓取飞书数据...');
    execSync('node scripts/fetch-from-doc.js', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // 2. 构建项目
    console.log('2. 构建项目...');
    execSync('rm -rf .next out && pnpm build', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // 3. 上传到 Cloudflare Pages
    console.log('3. 上传到 Cloudflare Pages...');
    execSync(`CLOUDFLARE_API_TOKEN=${CF_API_TOKEN} CLOUDFLARE_ACCOUNT_ID=${CF_ACCOUNT_ID} npx wrangler pages deploy out --project-name=${CF_PROJECT_NAME}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    // 4. 清除 CDN 缓存
    console.log('4. 清除 CDN 缓存...');
    await purgeCache();
    
    console.log('✅ 更新完成！');
    console.log('访问地址：https://meimei-dashboard.pages.dev');
  } catch (error) {
    console.error('更新失败:', error.message);
    process.exit(1);
  }
}

async function purgeCache() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${CF_PROJECT_NAME}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        files: ['/*']
      }),
    }
  );
  
  if (res.ok) {
    console.log('  ✓ CDN 缓存已清除');
  } else {
    console.log('  ⚠ CDN 缓存清除失败（不影响使用）');
  }
}

main();
