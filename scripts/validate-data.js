#!/usr/bin/env node
/**
 * 数据自检脚本
 * 检查数据完整性、异常值、逻辑错误
 */

const fs = require('fs');
const path = require('path');

const mockDataPath = path.join(__dirname, '../src/lib/mock-data.ts');
const mockDataContent = fs.readFileSync(mockDataPath, 'utf-8');

// 提取数据
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

// 自检项
const checks = [];

function check(name, condition, message) {
  checks.push({ name, passed: condition, message });
  if (!condition) {
    console.warn(`️ ${name}: ${message}`);
  } else {
    console.log(`✅ ${name}`);
  }
}

// 1. 数据量检查
function checkDataVolume(data) {
  check('数据量检查', data.length > 0, `数据为空`);
  check('数据量充足', data.length > 100, `数据量不足：${data.length} 条`);
}

// 2. 日期连续性检查
function checkDateContinuity(data) {
  const dates = [...new Set(data.map(r => r.date))].sort();
  check('日期范围', dates.length > 0, '无日期数据');
  
  if (dates.length > 1) {
    const first = dates[0];
    const last = dates[dates.length - 1];
    check('日期范围合理', first !== last, `只有一个日期：${first}`);
  }
}

// 3. 直播间检查
function checkRooms(data) {
  const rooms = [...new Set(data.map(r => r.roomName || r.room).filter(Boolean))];
  check('直播间数量', rooms.length > 0, '无直播间数据');
  check('直播间数量合理', rooms.length >= 2, `只有${rooms.length}个直播间`);
}

// 4. 主播检查
function checkStreamers(data) {
  const streamers = [...new Set(data.map(r => r.streamer).filter(Boolean))];
  check('主播数量', streamers.length > 0, '无主播数据');
  check('主播数量合理', streamers.length >= 5, `只有${streamers.length}位主播`);
}

// 5. 数值合理性检查
function checkValues(data) {
  const invalidConsume = data.filter(r => r.consume < 0 || r.consume > 10000000);
  check('消耗值合理', invalidConsume.length === 0, `${invalidConsume.length}条记录消耗异常`);
  
  const invalidPremium = data.filter(r => r.premium < 0 || r.premium > 100000000);
  check('保费值合理', invalidPremium.length === 0, `${invalidPremium.length}条记录保费异常`);
  
  const invalidDuration = data.filter(r => r.duration < 0 || r.duration > 1440); // 最多24小时=1440分钟
  check('时长合理', invalidDuration.length === 0, `${invalidDuration.length}条记录时长异常`);
}

// 6. ROI 合理性检查
function checkROI(data) {
  const recordsWithROI = data.filter(r => r.consume > 0);
  const invalidROI = recordsWithROI.filter(r => {
    const roi = r.premium / r.consume;
    return roi < 0 || roi > 100;
  });
  check('ROI 合理', invalidROI.length === 0, `${invalidROI.length}条记录 ROI 异常`);
}

// 7. 数据完整性检查
function checkCompleteness(data) {
  const incomplete = data.filter(r => {
    return !r.date || !(r.roomName || r.room) || !r.streamer || 
           r.consume === undefined || r.premium === undefined || 
           r.policies === undefined || r.duration === undefined;
  });
  check('数据完整', incomplete.length === 0, `${incomplete.length}条记录字段缺失`);
}

// 8. 最新日期检查
function checkLatestDate(data) {
  const latestDate = data.reduce((latest, r) => {
    const normR = r.date.split('.').map((v, i) => i === 0 ? v : v.padStart(2, '0')).join('-');
    const normLatest = latest.split('.').map((v, i) => i === 0 ? v : v.padStart(2, '0')).join('-');
    return normR > normLatest ? r.date : latest;
  }, '');
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}.${yesterday.getMonth() + 1}.${yesterday.getDate()}`;
  
  check('最新日期是昨天或今天', 
    latestDate === todayStr || latestDate === yesterdayStr,
    `最新日期：${latestDate}，期望：${yesterdayStr} 或 ${todayStr}`
  );
}

// 主函数
function main() {
  console.log('=== 数据自检开始 ===\n');
  
  const data = extractData();
  
  checkDataVolume(data);
  checkDateContinuity(data);
  checkRooms(data);
  checkStreamers(data);
  checkValues(data);
  checkROI(data);
  checkCompleteness(data);
  checkLatestDate(data);
  
  console.log('\n=== 自检结果 ===');
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  console.log(`通过：${passed}/${total}`);
  
  if (passed === total) {
    console.log('✅ 所有检查通过！');
    process.exit(0);
  } else {
    console.log('⚠️ 有检查未通过，请查看上方警告');
    process.exit(1);
  }
}

main();
