#!/usr/bin/env node
/**
 * 从飞书电子表格获取数据
 * 所有表格列结构完全一致，使用固定列索引
 */

const fs = require('fs');
const path = require('path');

const APP_ID = 'cli_aafb3dec53f89bea';
const APP_SECRET = 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';
const DOC_TOKEN = 'BmeXwIVhziP867kk5DvcUEPCnuc';

// 表格配置（包含列索引）
const TABLE_CONFIGS = {
  'XjXjs4wjphBpSatmxH4cZVn2nMh': {
    name: '平安健康-E生保',
    colDate: 0,
    colTimeSlot: 1,
    colStreamer: 2,
    colVideoCost: 4,
    colDirectCost: 5,
    colPolicies: 6,
    colPremium: 7,
    calcTotalCost: true, // 总消耗 = 视频消耗 + 直投消耗
  },
  'JZe3sSOlyh0TFdtyukUc46XDnLb': {
    name: '平安健康-全家保',
    colDate: 0,
    colTimeSlot: 1,
    colStreamer: 2,
    colVideoCost: 4,
    colDirectCost: 5,
    colPolicies: 6,
    colPremium: 7,
    calcTotalCost: true,
  },
  'A1F1sQhPQhvMPytHjhHckL1vnEg': {
    name: '泰康-泰全能',
    colDate: 0,
    colStreamer: 1,
    colTimeSlot: 2,
    colDirectCost: 4,
    colMaterialCost: 5,
    colMixedCost: 6,
    colPolicies: 7,
    colPremium: 8,
    calcTotalCost: true, // 总消耗 = 直投 + 素材 + 混投
  },
  'MSwTsWR04hAFJpt9dVuc13nsnmb': {
    name: '泰康-普惠增强版',
    colDate: 0,
    colStreamer: 1,
    colTimeSlot: 2,
    colTotalCost: 3,
    colDirectCost: 4,
    colMaterialCost: 5,
    colPolicies: 6,
    colPremium: 7,
  },
  'KABAsVYhNh9S2ItXDB8cPKDCnRh': {
    name: '平安健康-E生安心',
    colDate: 0,
    colTimeSlot: 1,
    colStreamer: 2,
    colVideoCost: 4,
    colDirectCost: 5,
    colPolicies: 6,
    colPremium: 7,
    calcTotalCost: true,
  },
  'GVUPsAF1zhFOdEtyfNKcmF0VnfD': {
    name: '平安财河北-中高端医疗',
    colDate: 0,
    colStreamer: 1,
    colTimeSlot: 2,
    colTotalCost: 3,
    colPolicies: 4,
    colPremium: 5,
  },
};

async function getTenantToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取 tenant_access_token 失败: ${JSON.stringify(data)}`);
  return data.tenant_access_token;
}

async function getSheets(token, spreadsheetToken) {
  const resp = await fetch(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取表格列表失败: ${JSON.stringify(data)}`);
  return data.data.sheets;
}

async function getSheetData(token, spreadsheetToken, sheetId) {
  // 飞书 API 的 range 参数实际不起作用，每次返回固定的 875 行
  // 但这 875 行已包含所有日期的数据（从 8.1 到 8.28）
  const resp = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`获取表格数据失败: ${JSON.stringify(data)}`);
  const rows = data.data.valueRange.values;
  console.log(`  获取到 ${rows.length} 行数据`);
  return rows;
}

function excelSerialToDate(serial) {
  const utcDays = serial - 25569;
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}`;
}

function normalizeDate(dateVal) {
  if (typeof dateVal === 'number') {
    return excelSerialToDate(dateVal);
  }
  
  const str = String(dateVal).trim();
  
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}.${parseInt(parts[1])}.${parseInt(parts[2])}`;
  }
  
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
    const parts = str.split('/');
    return `${parts[0]}.${parseInt(parts[1])}.${parseInt(parts[2])}`;
  }
  
  if (/^\d{8}$/.test(str)) {
    const year = str.substring(0, 4);
    const month = parseInt(str.substring(4, 6));
    const day = parseInt(str.substring(6, 8));
    return `${year}.${month}.${day}`;
  }
  
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(str)) {
    return str;
  }
  
  return str;
}

function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // 检查是否是公式字符串（如 "E806+F806" 或 "=SUM(...)"）
    if (val.match(/[A-Z]\d+\+[A-Z]\d+/) || val.startsWith('=')) {
      return 0; // 公式字符串，稍后处理
    }
    if (/[a-zA-Z+\-*/]/.test(val)) return 0; // 其他公式字符串返回0
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 计算公式的值
function evaluateFormula(formula, rows) {
  if (!formula || typeof formula !== 'string') return 0;
  
  // 移除开头的 =
  if (formula.startsWith('=')) {
    formula = formula.substring(1);
  }
  
  // 处理 SUM 函数，如 "SUM(E806:E807)"
  const sumMatch = formula.match(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/i);
  if (sumMatch) {
    const [, startCol, startRow, , endRow] = sumMatch;
    const colIdx = startCol.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    let sum = 0;
    for (let r = parseInt(startRow) - 1; r < parseInt(endRow); r++) {
      const val = parseNumber(rows[r]?.[colIdx]);
      sum += val;
    }
    return sum;
  }
  
  // 处理加法公式，如 "E806+F806"
  const addMatch = formula.match(/([A-Z])(\d+)\+([A-Z])(\d+)/i);
  if (addMatch) {
    const [, col1, row1, col2, row2] = addMatch;
    const col1Idx = col1.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    const col2Idx = col2.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    const val1 = parseNumber(rows[parseInt(row1) - 1]?.[col1Idx]);
    const val2 = parseNumber(rows[parseInt(row2) - 1]?.[col2Idx]);
    return val1 + val2;
  }
  
  return 0;
}

function parseInteger(val) {
  const num = parseNumber(val);
  return Math.round(num);
}

function parseData(rows, config) {
  const { name: roomName, colDate, colTimeSlot, colStreamer, colVideoCost, colDirectCost, colTotalCost, colPolicies, colPremium, calcTotalCost } = config;
  
  if (!rows || rows.length < 2) {
    console.log(`  表格数据不足，跳过`);
    return [];
  }

  const records = [];
  let currentDate = null;
  let skipped = 0;

  // 跳过表头行（第 0 行可能是分类行，第 1 行是列名行）
  // 找到实际数据开始行
  let dataStartRow = 1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    // 检查是否是表头行（包含"日期"、"主播"等关键字）
    const rowStr = row.join(' ').toLowerCase();
    if (rowStr.includes('日期') && (rowStr.includes('主播') || rowStr.includes('时间段'))) {
      dataStartRow = i + 1;
      break;
    }
  }

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // 处理日期列（合并单元格）
    const dateVal = row[colDate];
    if (dateVal && dateVal !== '' && dateVal !== null) {
      const normalized = normalizeDate(dateVal);
      if (/^\d{4}\.\d+\.\d+$/.test(normalized)) {
        currentDate = normalized;
      }
    }
    
    if (!currentDate) {
      skipped++;
      continue;
    }

    // 获取时间段和主播
    let timeSlot = row[colTimeSlot];
    let streamer = row[colStreamer];
    
    timeSlot = typeof timeSlot === 'string' ? timeSlot.trim() : String(timeSlot || '').trim();
    streamer = typeof streamer === 'string' ? streamer.trim() : '';
    
    // 过滤表头行
    if (streamer === '主播' || streamer === 'null' || streamer === '') {
      skipped++;
      continue;
    }
    if (timeSlot === '时间段' || timeSlot === '时间' || timeSlot === 'null') {
      skipped++;
      continue;
    }
    
    // 过滤汇总行和合计行
    if (streamer.includes('汇总') || streamer.includes('合计') || streamer.includes('总计') || streamer.includes('基础信息')) {
      skipped++;
      continue;
    }
    if (timeSlot.includes('汇总') || timeSlot.includes('合计') || timeSlot.includes('总计') || timeSlot.includes('基础信息')) {
      skipped++;
      continue;
    }
    
    // 验证主播名（必须是 2-6 个中文字符）
    if (!/^[\u4e00-\u9fa5·]{2,6}$/.test(streamer)) {
      skipped++;
      continue;
    }
    
    // 过滤系统账号
    if (streamer.includes('助手') || streamer.includes('系统') || streamer.includes('测试') || streamer.includes('保费')) {
      skipped++;
      continue;
    }
    
    // 验证时间段格式
    if (timeSlot && !/^\d{1,2}:\d{2}[-~]\d{1,2}:\d{2}$/.test(timeSlot)) {
      skipped++;
      continue;
    }

    // 读取数值
    let totalCost;
    if (config.calcTotalCost) {
      if (config.colMixedCost !== undefined) {
        // 泰康-泰全能：总消耗 = 直投消耗 + 素材消耗 + 混投消耗
        const directCost = parseNumber(row[config.colDirectCost]);
        const materialCost = parseNumber(row[config.colMaterialCost]);
        const mixedCost = parseNumber(row[config.colMixedCost]);
        totalCost = directCost + materialCost + mixedCost;
      } else {
        // 平安健康系列：总消耗 = 视频投放消耗 + 直投消耗
        const videoCost = parseNumber(row[config.colVideoCost]);
        const directCost = parseNumber(row[config.colDirectCost]);
        totalCost = videoCost + directCost;
      }
    } else {
      // 泰康-普惠增强版：优先读取总消耗列，如果是公式则计算
      const totalCostVal = row[config.colTotalCost];
      if (typeof totalCostVal === 'string' && (totalCostVal.match(/[A-Z]\d+\+[A-Z]\d+/) || totalCostVal.startsWith('='))) {
        // 总消耗列是公式，计算公式
        totalCost = evaluateFormula(totalCostVal, rows);
      } else {
        const directTotalCost = parseNumber(totalCostVal);
        if (directTotalCost > 0) {
          totalCost = directTotalCost;
        } else {
          // 总消耗列是公式(0)，从直投+素材计算
          const directCost = parseNumber(row[config.colDirectCost]);
          const materialCost = parseNumber(row[config.colMaterialCost]);
          totalCost = directCost + materialCost;
        }
      }
    }
    
    // 保单数（支持公式）
    const policiesVal = row[config.colPolicies];
    let policies;
    if (typeof policiesVal === 'string' && (policiesVal.match(/SUM\([A-Z]\d+:[A-Z]\d+\)/i) || policiesVal.startsWith('='))) {
      policies = Math.round(evaluateFormula(policiesVal, rows));
    } else {
      policies = parseInteger(policiesVal);
    }
    
    // 年化保费（支持公式）
    const premiumVal = row[config.colPremium];
    let premium;
    if (typeof premiumVal === 'string' && (premiumVal.match(/[A-Z]\d+\+[A-Z]\d+/) || premiumVal.startsWith('='))) {
      premium = evaluateFormula(premiumVal, rows);
    } else {
      premium = parseNumber(premiumVal);
    }
    
    // 计算 ROI = 年化保费 / 总消耗
    const roi = totalCost > 0 ? parseFloat((premium / totalCost).toFixed(3)) : 0;

    records.push({
      date: currentDate,
      roomName,
      streamer,
      timeSlot,
      consume: Math.round(totalCost * 100) / 100,
      premium: Math.round(premium * 100) / 100,
      policies,
      roi,
      avgPolicy: policies > 0 ? Math.round((premium / policies) * 100) / 100 : 0,
      duration: 60, // 每条记录代表1小时直播
      timeCost: totalCost > 0 ? Math.round(totalCost * 100) / 100 : 0, // 时耗 = 消耗/小时
    });
  }

  console.log(`  解析完成：${records.length} 条记录，跳过 ${skipped} 行`);
  return records;
}

async function main() {
  console.log('=== 飞书数据抓取（按配置列索引模式）===');
  console.log(`文档 Token: ${DOC_TOKEN}`);
  console.log(`共 ${Object.keys(TABLE_CONFIGS).length} 个表格\n`);

  const token = await getTenantToken();
  console.log('✅ 获取 tenant_access_token 成功\n');

  const allRecords = [];

  for (const [tableToken, config] of Object.entries(TABLE_CONFIGS)) {
    console.log(`处理表格: ${config.name}`);
    console.log(`  Token: ${tableToken}`);

    try {
      const sheets = await getSheets(token, tableToken);
      console.log(`  找到 ${sheets.length} 个 sheet`);

      // 选择最新的 sheet（按年月排序）
      const validSheets = sheets.filter(s => {
        const t = s.title;
        if (t.includes('模版') || t.includes('模板') || t.startsWith('Sheet') || t.includes('刷单')) return false;
        return /\d{2,4}年?\d{1,2}月?/.test(t) || /\d{4}\.\d+/.test(t) || t.includes('月');
      });
      
      // 从 sheet 标题中提取年月，用于排序
      function extractYearMonth(title) {
        // 优先匹配带年份的："26年8月" / "2026年8月" / "2026.8"
        let m = title.match(/(\d{4})[年.\-](\d{1,2})月?/);
        if (m) return { year: parseInt(m[1]), month: parseInt(m[2]), hasYear: true };
        m = title.match(/(\d{2})年(\d{1,2})月/);
        if (m) return { year: 2000 + parseInt(m[1]), month: parseInt(m[2]), hasYear: true };
        // 不带年份的："8月" / "12月" - 标记为无年份，排序靠后
        m = title.match(/(\d{1,2})月/);
        if (m) return { year: 0, month: parseInt(m[1]), hasYear: false };
        return { year: 0, month: 0, hasYear: false };
      }
      
      validSheets.sort((a, b) => {
        const ya = extractYearMonth(a.title);
        const yb = extractYearMonth(b.title);
        // 优先选择有明确年份的
        if (ya.hasYear !== yb.hasYear) return yb.hasYear ? 1 : -1;
        if (ya.year !== yb.year) return yb.year - ya.year;
        return yb.month - ya.month;
      });
      
      const latestSheet = validSheets.length > 0 ? validSheets[0] : sheets[sheets.length - 1];
      console.log(`  使用 sheet: ${latestSheet.title} (${latestSheet.sheet_id})`);

      const rows = await getSheetData(token, tableToken, latestSheet.sheet_id);
      console.log(`  读取到 ${rows.length} 行数据`);

      const records = parseData(rows, config);
      allRecords.push(...records);

      console.log(`  ✅ 成功\n`);
    } catch (err) {
      console.error(`   失败: ${err.message}\n`);
    }
  }

  console.log(`\n=== 总计: ${allRecords.length} 条记录 ===`);

  const rooms = [...new Set(allRecords.map(r => r.roomName))];
  const streamers = [...new Set(allRecords.map(r => r.streamer))];
  const dates = [...new Set(allRecords.map(r => r.date))].sort();

  console.log(`\n统计信息:`);
  console.log(`  直播间数量: ${rooms.length}`);
  console.log(`  主播数量: ${streamers.length}`);
  console.log(`  日期范围: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log(`  每个直播间的记录数:`);
  rooms.forEach(room => {
    const count = allRecords.filter(r => r.roomName === room).length;
    console.log(`    ${room}: ${count} 条`);
  });

  const outputPath = path.join(__dirname, '../src/lib/mock-data.ts');
  const content = `// 自动从飞书文档抓取
// 抓取时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
// 文档 Token: ${DOC_TOKEN}
// 固定列索引：日期=0, 时间段=1, 主播=2, 视频消耗=4, 直投消耗=5, 保单量=6, 保费=7
// 总消耗 = 视频消耗 + 直投消耗（计算得出）
// ROI = 保费 / 总消耗（计算得出）

export interface SessionRecord {
  date: string;
  roomName: string;
  streamer: string;
  timeSlot: string;
  consume: number;
  premium: number;
  policies: number;
  roi: number;
  avgPolicy: number;
  duration: number;
  timeCost: number;
}

export const SESSION_RECORDS: SessionRecord[] = ${JSON.stringify(allRecords, null, 2)};

export const LIVE_ROOMS = ${JSON.stringify(rooms, null, 2)};

// 兼容前端代码的字段名
export const ROOM_LIST = LIVE_ROOMS;
export const mockData = SESSION_RECORDS.map(r => ({
  ...r,
  room: r.roomName,
}));
`;

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`\n✅ 数据已写入 ${outputPath}`);
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
