// Cloudflare Worker - 定时更新飞书数据
// 每天早上 8 点（北京时间）自动运行

const FEISHU_APP_ID = 'cli_aafb3dec53f89bea';
const FEISHU_APP_SECRET = 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';
const DOC_TOKEN = 'BmeXwIVhziP867kk5DvcUEPCnuc';

export default {
  async scheduled(event, env, ctx) {
    console.log('定时任务触发:', new Date().toISOString());
    
    try {
      // 1. 获取飞书 Token
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          app_id: FEISHU_APP_ID, 
          app_secret: FEISHU_APP_SECRET 
        }),
      });
      const tokenData = await tokenRes.json();
      const token = tokenData.tenant_access_token;
      
      if (!token) {
        console.error('获取 Token 失败');
        return;
      }
      
      // 2. 获取文档表格列表
      const docRes = await fetch(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${DOC_TOKEN}/blocks?page_size=500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const docData = await docRes.json();
      
      const tables = [];
      docData.data?.items?.forEach((block) => {
        const blockStr = JSON.stringify(block);
        if (blockStr.includes('mention_doc') && blockStr.includes('sheets')) {
          const match = blockStr.match(/"token":"([^"]+)"/);
          const titleMatch = blockStr.match(/"title":"([^"]+)"/);
          if (match) {
            tables.push({
              token: match[1],
              title: titleMatch ? titleMatch[1] : 'Unknown',
            });
          }
        }
      });
      
      console.log(`找到 ${tables.length} 个表格`);
      
      // 3. 抓取每个表格的数据
      const allRecords = [];
      
      for (const table of tables) {
        console.log(`处理表格: ${table.title}`);
        
        // 获取工作表列表
        const metaRes = await fetch(
          `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${table.token}/sheets/query`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const metaData = await metaRes.json();
        const sheets = metaData.data?.sheets || [];
        
        // 过滤有效工作表
        const recentSheets = sheets.filter(s => {
          const t = s.title;
          if (t.includes('模版') || t.includes('模板')) return false;
          return /\d{2,4}年?\d{1,2}月?/.test(t) || /\d{4}\.\d+/.test(t);
        }).slice(0, 15);
        
        for (const sheet of recentSheets) {
          const dataRes = await fetch(
            `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${table.token}/values/${sheet.sheet_id}!A1:AG2000`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const data = await dataRes.json();
          const rows = data.data?.valueRange?.values || [];
          
          let currentDate = '';
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rawDate = row[0];
            const time = row[1];
            const streamer = row[2];
            
            if (rawDate != null && rawDate !== '') {
              if (typeof rawDate === 'number') {
                const utcDays = rawDate - 25569;
                const utcMs = utcDays * 86400 * 1000;
                const d = new Date(utcMs);
                currentDate = `${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}`;
              } else if (typeof rawDate === 'string') {
                const trimmed = rawDate.trim();
                if (trimmed === '基础信息' || trimmed === '日期' || trimmed === ' ' || trimmed === '') continue;
                currentDate = trimmed;
              }
            }
            
            if (!time) continue;
            
            const timeStr = typeof time === 'string' ? time : '';
            const streamerStr = typeof streamer === 'string' ? streamer : '';
            if (timeStr.includes('汇总') || timeStr.includes('合计')) continue;
            if (streamerStr.includes('汇总') || streamerStr.includes('合计')) continue;
            if (!streamerStr.trim()) continue;
            if (timeStr === '时间' || streamerStr === '主播') continue;
            
            if (!currentDate || !/^\d{4}\.\d+\.\d+$/.test(currentDate)) continue;
            
            const shortVideoConsume = parseFloat(row[4]) || 0;
            const directConsume = parseFloat(row[5]) || 0;
            const totalConsume = shortVideoConsume + directConsume;
            const policies = parseInt(row[6]) || 0;
            const premium = parseFloat(row[7]) || 0;
            const roi = totalConsume > 0 ? parseFloat((premium / totalConsume).toFixed(2)) : 0;
            
            let streamerName = streamerStr.replace(/\s+/g, '').trim();
            if (streamerName === '孙文曜') streamerName = '孙文耀';
            
            const roomName = table.title
              .replace(/内部数据自查表$/g, '')
              .replace(/[-]?小时报$/g, '')
              .replace(/\s+/g, '')
              .trim();
            
            allRecords.push({
              date: currentDate,
              timeSlot: time,
              streamer: streamerName,
              room: roomName,
              consume: parseFloat(totalConsume.toFixed(2)),
              premium: parseFloat(premium.toFixed(2)),
              policies: policies,
              roi: roi,
              duration: 60,
              timeCost: parseFloat(totalConsume.toFixed(2)),
            });
          }
        }
      }
      
      console.log(`总共抓取 ${allRecords.length} 条记录`);
      
      // 4. 存入 KV
      await env.MEIMEI_DATA.put('latest-data', JSON.stringify(allRecords));
      
      console.log('✅ 数据更新完成！');
    } catch (error) {
      console.error(' 更新失败:', error.message);
    }
  }
};
