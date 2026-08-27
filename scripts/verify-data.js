#!/usr/bin/env node
/**
 * 验证数据质量
 */

const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../src/lib/mock-data.ts');
const content = fs.readFileSync(dataFile, 'utf-8');

// 提取 SESSION_RECORDS
const match = content.match(/export const SESSION_RECORDS.*?= (\[[\s\S]*?\]);/);
if (!match) {
  console.error('无法提取 SESSION_RECORDS');
  process.exit(1);
}

const records = JSON.parse(match[1]);

console.log(`总记录数: ${records.length}\n`);

// 按直播间分组
const byRoom = {};
records.forEach(r => {
  if (!byRoom[r.roomName]) byRoom[r.roomName] = [];
  byRoom[r.roomName].push(r);
});

// 检查每个直播间
for (const [roomName, roomRecords] of Object.entries(byRoom)) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`直播间: ${roomName} (${roomRecords.length} 条记录)`);
  
  // 检查主播列
  const streamers = [...new Set(roomRecords.map(r => r.streamer))];
  console.log(`\n主播列表 (${streamers.length} 人):`);
  streamers.forEach(s => console.log(`  - ${s}`));
  
  // 检查是否有时间段格式的主播名
  const invalidStreamers = streamers.filter(s => /^\d{1,2}:\d{2}/.test(s));
  if (invalidStreamers.length > 0) {
    console.log(`\n❌ 错误：发现时间段格式的主播名:`);
    invalidStreamers.forEach(s => console.log(`  - ${s}`));
  }
  
  // 检查保单数
  const totalPolicies = roomRecords.reduce((sum, r) => sum + r.policies, 0);
  const maxPolicies = Math.max(...roomRecords.map(r => r.policies));
  const avgPolicies = totalPolicies / roomRecords.length;
  
  console.log(`\n保单数统计:`);
  console.log(`  总保单数: ${totalPolicies}`);
  console.log(`  平均保单数: ${avgPolicies.toFixed(2)}`);
  console.log(`  最大保单数: ${maxPolicies}`);
  
  // 找出保单数异常高的记录
  const abnormalPolicies = roomRecords.filter(r => r.policies > 1000);
  if (abnormalPolicies.length > 0) {
    console.log(`\n❌ 警告：发现保单数异常高的记录:`);
    abnormalPolicies.forEach(r => {
      console.log(`  - ${r.date} ${r.streamer} ${r.timeSlot}: ${r.policies} 单`);
    });
  }
  
  // 检查时间段
  const timeSlots = [...new Set(roomRecords.map(r => r.timeSlot))];
  console.log(`\n时间段列表 (${timeSlots.length} 个):`);
  timeSlots.slice(0, 10).forEach(t => console.log(`  - ${t}`));
  if (timeSlots.length > 10) console.log(`  ... 还有 ${timeSlots.length - 10} 个`);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`验证完成`);
