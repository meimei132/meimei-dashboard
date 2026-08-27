import { mockData } from './src/lib/mock-data.js';

// 检查是否有"主播汇总"行
const summaryRows = mockData.filter(r => 
  r.streamer && (r.streamer.includes('汇总') || r.streamer.includes('合计'))
);

console.log('包含"汇总"或"合计"的记录数:', summaryRows.length);
if (summaryRows.length > 0) {
  console.log('前 5 条:');
  summaryRows.slice(0, 5).forEach(r => {
    console.log(`  ${r.date} | ${r.time} | ${r.streamer} | ${r.room} | 消耗=${r.consume}`);
  });
}

// 检查 2026.8.24 的数据
const aug24 = mockData.filter(r => r.date === '2026.8.24');
console.log('\n2026.8.24 记录数:', aug24.length);

// 按主播分组
const byStreamer = {};
aug24.forEach(r => {
  if (!byStreamer[r.streamer]) byStreamer[r.streamer] = { count: 0, consume: 0, premium: 0 };
  byStreamer[r.streamer].count++;
  byStreamer[r.streamer].consume += r.consume;
  byStreamer[r.streamer].premium += r.premium;
});

console.log('\n按主播分组:');
Object.entries(byStreamer).forEach(([streamer, data]) => {
  console.log(`  ${streamer}: ${data.count}条, 消耗=${data.consume.toFixed(2)}, 保费=${data.premium.toFixed(2)}`);
});

// 检查是否有重复数据（同一主播在同一时间段有多条记录）
console.log('\n检查重复数据:');
const timeStreamerMap = {};
aug24.forEach(r => {
  const key = `${r.time}-${r.streamer}`;
  if (!timeStreamerMap[key]) timeStreamerMap[key] = [];
  timeStreamerMap[key].push(r);
});

const duplicates = Object.entries(timeStreamerMap).filter(([key, records]) => records.length > 1);
if (duplicates.length > 0) {
  console.log('发现重复数据:');
  duplicates.forEach(([key, records]) => {
    console.log(`  ${key}: ${records.length}条`);
    records.forEach(r => {
      console.log(`    ${r.room} | 消耗=${r.consume} | 保费=${r.premium}`);
    });
  });
} else {
  console.log('无重复数据');
}
