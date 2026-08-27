const FEISHU_APP_ID = 'cli_aafb3dec53f89bea';
const FEISHU_APP_SECRET = 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';
const SPREADSHEET_TOKEN = 'XjXjs4wjphBpSatmxH4cZVn2nMh';

async function getAccessToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }),
  });
  const data = await res.json();
  return data.tenant_access_token;
}

async function getSheets(token) {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${SPREADSHEET_TOKEN}/sheets/query`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.data?.sheets || [];
}

async function getSheetData(token, sheetId) {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SPREADSHEET_TOKEN}/values/${sheetId}!A1:AG2000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.data?.valueRange?.values || [];
}

function parseCell(cell) {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'string') return cell;
  if (Array.isArray(cell)) return cell.map(s => s.text || '').join('');
  if (cell.text) return cell.text;
  return null;
}

function extractRecords(rows, month) {
  const records = [];
  let currentDate = '';
  
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const date = parseCell(row[0]);
    const time = parseCell(row[1]);
    const streamer = parseCell(row[2]);
    
    // 更新日期
    if (date) currentDate = date;
    
    // 跳过汇总行和空行
    if (!time) continue;
    if (time.includes('汇总')) continue;
    
    // 使用实际数值列
    const shortVideoConsume = parseFloat(row[4]) || 0;
    const directConsume = parseFloat(row[5]) || 0;
    const totalConsume = shortVideoConsume + directConsume;
    const policies = parseInt(row[6]) || 0;
    const premium = parseFloat(row[7]) || 0;
    const roi = totalConsume > 0 ? parseFloat((premium / totalConsume).toFixed(2)) : 0;
    
    records.push({
      date: currentDate,
      time: time,
      streamer: streamer || '',
      room: '直播间', // 需要从表格名称或其他地方获取
      consume: totalConsume,
      premium: premium,
      policies: policies,
      roi: roi,
      duration: 1,
      month: month,
    });
  }
  
  return records;
}

async function main() {
  console.log('Fetching access token...');
  const token = await getAccessToken();
  
  console.log('Getting sheets list...');
  const sheets = await getSheets(token);
  console.log(`Found ${sheets.length} sheets`);
  
  const allRecords = [];
  
  // 只处理最近几个月的工作表
  const recentSheets = sheets.filter(s => 
    s.title.includes('26年') || s.title.includes('2026') || s.title.includes('8月')
  ).slice(0, 10);
  
  for (const sheet of recentSheets) {
    console.log(`Processing: ${sheet.title}...`);
    const rows = await getSheetData(token, sheet.sheet_id);
    const month = sheet.title.match(/(\d{1,2})月/)?.[1] || sheet.title.match(/2026年(\d{1,2})月/)?.[1] || '';
    const records = extractRecords(rows, month);
    allRecords.push(...records);
    console.log(`  Extracted ${records.length} records`);
  }
  
  console.log(`\nTotal records: ${allRecords.length}`);
  
  // 保存数据
  const fs = require('fs');
  fs.writeFileSync('/tmp/all-records.json', JSON.stringify(allRecords, null, 2));
  console.log('Saved to /tmp/all-records.json');
}

main().catch(console.error);
