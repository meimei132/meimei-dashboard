// Cloudflare Worker - 定时触发器
// 每天早上 8 点（北京时间）自动更新数据

export default {
  async scheduled(event, env, ctx) {
    console.log('定时任务触发:', new Date().toISOString());
    
    try {
      // 调用自动更新 API
      const response = await fetch('https://your-api-endpoint.com/update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.UPDATE_SECRET}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ 更新成功');
      } else {
        console.error(' 更新失败:', await response.text());
      }
    } catch (error) {
      console.error('❌ 错误:', error.message);
    }
  }
};
