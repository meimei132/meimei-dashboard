// 数据自查程序
// 验证飞书数据与大屏显示的一致性

const fs = require('fs');
const path = require('path');

// 读取 mock-data.ts
const mockDataPath = path.join(__dirname, '../src/lib/mock-data.ts');
const content = fs.readFileSync(mockDataPath, 'utf-8');

// 提取 JSON 数据
const match = content.match(/export const mockData: SessionRecord\[\] = (\[[\s\S]*?\]);/);
if (!match) {
    console.error('❌ 无法提取 mockData 数据');
    process.exit(1);
}

const mockData = JSON.parse(match[1]);

console.log('=== 数据自查报告 ===\n');

// 1. 检查直播间数量
const rooms = [...new Set(mockData.map(r => r.room))];
console.log(`📊 直播间数量：${rooms.length}`);
rooms.forEach(room => {
    const count = mockData.filter(r => r.room === room).length;
    console.log(`   - ${room}: ${count} 条记录`);
});

// 2. 检查数据字段完整性
const requiredFields = ['date', 'timeSlot', 'streamer', 'consume', 'premium', 'policies', 'roi', 'duration', 'timeCost', 'room'];
const missingFields = [];
mockData.forEach((record, index) => {
    requiredFields.forEach(field => {
        if (record[field] === undefined || record[field] === null) {
            missingFields.push({ index, field, value: record[field] });
        }
    });
});

if (missingFields.length > 0) {
    console.log(`\n⚠️  发现 ${missingFields.length} 个缺失字段：`);
    missingFields.slice(0, 10).forEach(m => {
        console.log(`   - 记录 ${m.index}: 字段 "${m.field}" 值为 ${m.value}`);
    });
    if (missingFields.length > 10) {
        console.log(`   ... 还有 ${missingFields.length - 10} 个`);
    }
} else {
    console.log('\n✅ 所有数据字段完整');
}

// 3. 检查日期范围
const dates = [...new Set(mockData.map(r => r.date))].sort();
console.log(`\n📅 日期范围：${dates[0]} ~ ${dates[dates.length - 1]}`);
console.log(`   总共 ${dates.length} 天`);

// 4. 检查最新日期
const latestDate = dates[dates.length - 1];
console.log(`   最新日期：${latestDate}`);

// 5. 检查每个直播间的数据质量
console.log('\n 各直播间数据质量：');
rooms.forEach(room => {
    const roomData = mockData.filter(r => r.room === room);
    const roomDates = [...new Set(roomData.map(r => r.date))].sort();
    const streamers = [...new Set(roomData.map(r => r.streamer))];
    
    console.log(`   ${room}:`);
    console.log(`     - 记录数：${roomData.length}`);
    console.log(`     - 日期范围：${roomDates[0]} ~ ${roomDates[roomDates.length - 1]}`);
    console.log(`     - 主播数：${streamers.length}`);
    
    // 检查空值
    const emptyStreamers = roomData.filter(r => !r.streamer || r.streamer.trim() === '').length;
    if (emptyStreamers > 0) {
        console.log(`     ⚠️  空主播记录：${emptyStreamers}`);
    }
});

// 6. 验证与飞书文档的一致性
console.log('\n📋 飞书文档表格验证：');
const expectedTables = [
    '平安健康-E 生保',
    '平安健康-全家保',
    '泰康 - 泰全能',
    '泰康 - 普惠增强版',
    '平安健康-E 生安心'
];

const missingTables = expectedTables.filter(t => !rooms.includes(t));
const extraTables = rooms.filter(r => !expectedTables.includes(r));

if (missingTables.length > 0) {
    console.log(`   ️  缺失表格：${missingTables.join(', ')}`);
} else {
    console.log('   ✅ 所有预期表格都存在');
}

if (extraTables.length > 0) {
    console.log(`   ⚠️  额外表格：${extraTables.join(', ')}`);
} else {
    console.log('   ✅ 没有额外表格');
}

// 7. 总结
console.log('\n=== 自查总结 ===');
const issues = [];
if (rooms.length !== expectedTables.length) {
    issues.push(`直播间数量不匹配：期望 ${expectedTables.length} 个，实际 ${rooms.length} 个`);
}
if (missingFields.length > 0) {
    issues.push(`发现 ${missingFields.length} 个缺失字段`);
}

if (issues.length === 0) {
    console.log('✅ 数据验证通过，无问题');
} else {
    console.log('️  发现以下问题：');
    issues.forEach(issue => console.log(`   - ${issue}`));
}

console.log(`\n总记录数：${mockData.length}`);
console.log(`直播间数：${rooms.length}`);
console.log(`日期范围：${dates[0]} ~ ${latestDate}`);
