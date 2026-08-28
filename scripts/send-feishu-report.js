#!/usr/bin/env node
/**
 * 发送数据日报到飞书群
 * 包含：本月数据、昨日数据、直播间排名、主播预警/积极消息
 */

const fs = require('fs');
const path = require('path');

// 飞书群机器人 Webhook
const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';

if (!WEBHOOK_URL) {
  console.log('=== 飞书日报推送 ===');
  console.log('Webhook: 未配置');
  console.log('跳过飞书日报推送（请在 GitHub Secrets 中配置 FEISHU_WEBHOOK_URL）');
  process.exit(0);
}

// 读取数据
const mockDataPath = path.join(__dirname, '../src/lib/mock-data.ts');
const mockDataContent = fs.readFileSync(mockDataPath, 'utf-8');

// 从 mock-data.ts 中提取数据
function extractData() {
  const match = mockDataContent.match(/export const SESSION_RECORDS:\s*SessionRecord\[\]\s*=\s*(\[.*?\]);/s);
  if (!match) return [];
  
  try {
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

// 标准化日期
function normalizeDate(dateStr) {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 获取最新日期
function getLatestDate(data) {
  return data.reduce((latest, r) => {
    const normR = normalizeDate(r.date);
    const normLatest = normalizeDate(latest);
    return normR > normLatest ? r.date : latest;
  }, '');
}

// 获取当前月份 (YYYY.MM)
function getCurrentMonth(dateStr) {
  const parts = dateStr.split('.');
  return `${parts[0]}.${parts[1]}`;
}

// 格式化数字
function formatNumber(n) {
  return Math.round(n).toLocaleString('zh-CN');
}

// 聚合数据
function aggregateData(data) {
  const totalConsume = data.reduce((s, r) => s + r.consume, 0);
  const totalPremium = data.reduce((s, r) => s + r.premium, 0);
  const totalPolicies = data.reduce((s, r) => s + r.policies, 0);
  const totalDuration = data.reduce((s, r) => s + r.duration, 0);
  const roi = totalConsume > 0 ? (totalPremium / totalConsume).toFixed(2) : '0.00';
  const timeCost = totalDuration > 0 ? (totalConsume / (totalDuration / 60)).toFixed(2) : '0.00';
  
  return { totalConsume, totalPremium, totalPolicies, totalDuration, roi, timeCost };
}

// 按直播间聚合
function aggregateByRoom(data) {
  const roomMap = new Map();
  data.forEach(r => {
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

// 按主播聚合
function aggregateByStreamer(data) {
  const streamerMap = new Map();
  data.forEach(r => {
    const streamer = r.streamer;
    if (!streamerMap.has(streamer)) {
      streamerMap.set(streamer, { consume: 0, premium: 0, policies: 0, duration: 0, room: r.room });
    }
    const agg = streamerMap.get(streamer);
    agg.consume += r.consume;
    agg.premium += r.premium;
    agg.policies += r.policies;
    agg.duration += r.duration;
  });
  return Array.from(streamerMap.entries()).map(([streamer, agg]) => ({
    streamer,
    room: agg.room,
    ...agg,
    roi: agg.consume > 0 ? (agg.premium / agg.consume).toFixed(2) : '0.00',
  }));
}

// 检测预警和积极信号
function detectAlerts(data) {
  const alerts = [];
  const streamerData = aggregateByStreamer(data);
  
  // 按主播分组，获取每个主播的每日数据
  const streamerDailyMap = new Map();
  data.forEach(r => {
    const key = `${r.streamer}`;
    if (!streamerDailyMap.has(key)) {
      streamerDailyMap.set(key, []);
    }
    streamerDailyMap.get(key).push(r);
  });
  
  // 检测每个主播的趋势
  streamerDailyMap.forEach((records, streamer) => {
    // 按日期聚合
    const dailyMap = new Map();
    records.forEach(r => {
      if (!dailyMap.has(r.date)) {
        dailyMap.set(r.date, { consume: 0, premium: 0, duration: 0 });
      }
      const d = dailyMap.get(r.date);
      d.consume += r.consume;
      d.premium += r.premium;
      d.duration += r.duration;
    });
    
    const dates = [...dailyMap.keys()].sort();
    if (dates.length < 3) return;
    
    // 检查最近 3 天
    const last3 = dates.slice(-3);
    const rois = last3.map(d => {
      const dd = dailyMap.get(d);
      return dd.consume > 0 ? dd.premium / dd.consume : 0;
    });
    const timeCosts = last3.map(d => {
      const dd = dailyMap.get(d);
      return dd.duration > 0 ? dd.consume / (dd.duration / 60) : 0;
    });
    
    // ROI 连续 3 天下降 = 坏消息
    if (rois[0] > rois[1] && rois[1] > rois[2]) {
      alerts.push({
        type: 'bad',
        target: streamer,
        metric: 'ROI',
        values: rois.map(v => v.toFixed(2)),
      });
    }
    
    // ROI 连续 3 天上升 = 好消息
    if (rois[0] < rois[1] && rois[1] < rois[2]) {
      alerts.push({
        type: 'good',
        target: streamer,
        metric: 'ROI',
        values: rois.map(v => v.toFixed(2)),
      });
    }
    
    // 时耗连续 3 天上升 = 好消息（效率提高）
    if (timeCosts[0] < timeCosts[1] && timeCosts[1] < timeCosts[2]) {
      alerts.push({
        type: 'good',
        target: streamer,
        metric: '时耗',
        values: timeCosts.map(v => v.toFixed(2)),
      });
    }
    
    // 时耗连续 3 天下降 = 坏消息（效率降低）
    if (timeCosts[0] > timeCosts[1] && timeCosts[1] > timeCosts[2]) {
      alerts.push({
        type: 'bad',
        target: streamer,
        metric: '时耗',
        values: timeCosts.map(v => v.toFixed(2)),
      });
    }
  });
  
  return alerts;
}

// 构建飞书消息
function buildMessage(data) {
  const latestDate = getLatestDate(data);
  const currentMonth = getCurrentMonth(latestDate);
  
  // 本月数据
  const monthData = data.filter(r => r.date.startsWith(currentMonth));
  const monthAgg = aggregateData(monthData);
  
  // 昨日数据
  const yesterdayData = data.filter(r => r.date === latestDate);
  const yesterdayAgg = aggregateData(yesterdayData);
  
  // 直播间排名（按昨日消耗）
  const roomData = aggregateByRoom(yesterdayData);
  roomData.sort((a, b) => b.consume - a.consume);
  
  // 主播预警/积极消息
  const alerts = detectAlerts(data);
  const badAlerts = alerts.filter(a => a.type === 'bad');
  const goodAlerts = alerts.filter(a => a.type === 'good');
  
  // 构建消息内容
  let content = `📊 **美魅数据日报** - ${latestDate}\n\n`;
  
  // 本月数据
  content += `**📅 本月数据 (${currentMonth})**\n`;
  content += `总消耗：¥${formatNumber(monthAgg.totalConsume)}\n`;
  content += `总保费：¥${formatNumber(monthAgg.totalPremium)}\n`;
  content += `ROI：${monthAgg.roi}\n\n`;
  
  // 昨日数据
  content += `**📆 昨日数据 (${latestDate})**\n`;
  content += `总消耗：¥${formatNumber(yesterdayAgg.totalConsume)}\n`;
  content += `总保费：¥${formatNumber(yesterdayAgg.totalPremium)}\n`;
  content += `ROI：${yesterdayAgg.roi}\n\n`;
  
  // 直播间排名
  content += `**🏆 直播间排名 (昨日)**\n`;
  roomData.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    content += `${medal} ${r.room}\n`;
    content += `   消耗：¥${formatNumber(r.consume)} | 保费：¥${formatNumber(r.premium)} | ROI：${r.roi}\n`;
  });
  content += `\n`;
  
  // 预警消息
  if (badAlerts.length > 0) {
    content += `**⚠️ 预警消息**\n`;
    badAlerts.forEach(a => {
      content += `• ${a.target} - ${a.metric} 连续 3 天下降：${a.values.join(' → ')}\n`;
    });
    content += `\n`;
  }
  
  // 积极消息
  if (goodAlerts.length > 0) {
    content += `**🎉 积极信号**\n`;
    goodAlerts.forEach(a => {
      content += `• ${a.target} - ${a.metric} 连续 3 天上升：${a.values.join(' → ')}\n`;
    });
    content += `\n`;
  }
  
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
