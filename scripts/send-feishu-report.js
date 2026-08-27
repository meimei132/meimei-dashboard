#!/usr/bin/env node
/**
 * 发送数据日报到飞书群
 */

const fs = require('fs');
const path = require('path');

// 飞书群机器人 Webhook（需要用户配置）
const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';

// 读取数据
const mockDataPath = path.join(__dirname, '../src/lib/mock-data.ts');
const mockDataContent = fs.readFileSync(mockDataPath, 'utf-8');

// 从 mock-data.ts 中提取数据
function extractData() {
  const match = mockDataContent.match(/export const mockData:\s*SessionRecord\[\]\s*=\s*(\[.*?\]);/s);
  if (!match) return [];
  
  try {
    // 移除 TypeScript 类型注解
    const jsonStr = match[1]
      .replace(/:\s*SessionRecord/g, '')
      .replace(/:\s*string/g, '')
      .replace(/:\s*number/g, '');
    return eval(jsonStr);
  } catch (e) {
    console.error('解析数据失败:', e);
    return [];
  }
}

// 获取最新日期
function getLatestDate(data) {
  return data.reduce((latest, r) => {
    const normR = normalizeDate(r.date);
    const normLatest = normalizeDate(latest);
    return normR > normLatest ? r.date : latest;
  }, '');
}

function normalizeDate(dateStr) {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 聚合数据
function aggregateByRoom(data, date) {
  const roomMap = new Map();
  data.filter(r => r.date === date).forEach(r => {
    const room = r.room;
    if (!roomMap.has(room)) {
      roomMap.set(room, { consume: 0, premium: 0, policies: 0, duration: 0 });
    }
    const agg = roomMap.get(room);
    agg.consume += r.consume;
    agg.premium += r.premium;
    agg.policies += r.policies;
    agg.duration += r.duration;
  });
  return Array.from(roomMap.entries()).map(([room, agg]) => ({
    room,
    ...agg,
    roi: agg.consume > 0 ? (agg.premium / agg.consume).toFixed(2) : '0.00',
  }));
}

// 格式化数字
function formatNumber(n) {
  return Math.round(n).toLocaleString('zh-CN');
}

// 构建飞书消息
function buildMessage(data) {
  const latestDate = getLatestDate(data);
  const roomData = aggregateByRoom(data, latestDate);
  
  // 按消耗排序
  roomData.sort((a, b) => b.consume - a.consume);
  
  const totalConsume = roomData.reduce((s, r) => s + r.consume, 0);
  const totalPremium = roomData.reduce((s, r) => s + r.premium, 0);
  const totalPolicies = roomData.reduce((s, r) => s + r.policies, 0);
  
  let content = `📊 **美魅数据日报** - ${latestDate}\n\n`;
  content += `**整体数据**\n`;
  content += `总消耗：¥${formatNumber(totalConsume)}\n`;
  content += `总保费：¥${formatNumber(totalPremium)}\n`;
  content += `总保单：${formatNumber(totalPolicies)}\n`;
  content += `整体 ROI：${(totalPremium / totalConsume).toFixed(2)}\n\n`;
  
  content += `**直播间排名**\n`;
  roomData.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    content += `${medal} ${r.room}\n`;
    content += `   消耗：¥${formatNumber(r.consume)} | 保费：¥${formatNumber(r.premium)} | ROI：${r.roi}\n`;
  });
  
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '📊 美魅数据日报' },
        template: 'blue',
      },
      elements: [
        {
          tag: 'markdown',
          content: content,
        },
      ],
    },
  };
}

// 发送到飞书
async function sendToFeishu(message) {
  if (!WEBHOOK_URL) {
    console.error('未配置 FEISHU_WEBHOOK_URL');
    return false;
  }
  
  const resp = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  
  const data = await resp.json();
  if (data.code === 0 || data.StatusCode === 0) {
    console.log('✅ 飞书消息发送成功');
    return true;
  } else {
    console.error('❌ 飞书消息发送失败:', data);
    return false;
  }
}

// 主函数
async function main() {
  console.log('=== 飞书日报推送 ===');
  console.log('Webhook:', WEBHOOK_URL ? '已配置' : '未配置');
  
  const data = extractData();
  if (data.length === 0) {
    console.error('❌ 数据为空');
    process.exit(1);
  }
  
  console.log(`数据量：${data.length} 条`);
  
  const message = buildMessage(data);
  const success = await sendToFeishu(message);
  
  if (!success) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error('执行失败:', e);
  process.exit(1);
});
