#!/usr/bin/env node
/**
 * 调试脚本：读取每个表格的表头
 */

const APP_ID = 'cli_aafb3dec53f89bea';
const APP_SECRET = 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';

const TABLE_MAP = {
  'XjXjs4wjphBpSatmxH4cZVn2nMh': '平安健康-E生保',
  'JZe3sSOlyh0TFdtyukUc46XDnLb': '平安健康-全家保',
  'A1F1sQhPQhvMPytHjhHckL1vnEg': '泰康-泰全能',
  'MSwTsWR04hAFJpt9dVuc13nsnmb': '泰康-普惠增强版',
  'KABAsVYhNh9S2ItXDB8cPKDCnRh': '平安健康-E生安心',
};

async function getTenantToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await resp.json();
  return data.tenant_access_token;
}

async function getSheets(token, spreadsheetToken) {
  const resp = await fetch(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  return data.data.sheets;
}

async function getSheetData(token, spreadsheetToken, sheetId) {
  const resp = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  return data.data.valueRange.values;
}

function extractColumnName(cell) {
  if (typeof cell === 'string') return cell;
  if (Array.isArray(cell)) {
    // 富文本格式，提取 text 字段
    return cell.map(item => item.text || '').join('');
  }
  return String(cell);
}

async function main() {
  const token = await getTenantToken();
  
  console.log('=== 各表格表头分析 ===\n');
  
  for (const [tableToken, roomName] of Object.entries(TABLE_MAP)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`直播间: ${roomName}`);
    console.log(`Token: ${tableToken}`);
    
    try {
      const sheets = await getSheets(token, tableToken);
      console.log(`找到 ${sheets.length} 个 sheet`);
      
      // 使用最新的 sheet
      const latestSheet = sheets[sheets.length - 1];
      console.log(`最新 sheet: ${latestSheet.title} (${latestSheet.sheet_id})`);
      
      const rows = await getSheetData(token, tableToken, latestSheet.sheet_id);
      console.log(`总行数: ${rows.length}`);
      
      if (rows.length > 0) {
        console.log(`\n表头（第 0 行）:`);
        const header = rows[0];
        for (let i = 0; i < header.length; i++) {
          const colName = extractColumnName(header[i]);
          console.log(`  列${i}: "${colName}"`);
        }
        
        // 显示前 3 行数据样本
        console.log(`\n数据样本（前 3 行）:`);
        for (let rowIdx = 1; rowIdx < Math.min(4, rows.length); rowIdx++) {
          console.log(`  第 ${rowIdx} 行:`);
          const row = rows[rowIdx];
          for (let i = 0; i < Math.min(header.length, row.length); i++) {
            const val = row[i];
            const displayVal = typeof val === 'object' ? JSON.stringify(val) : val;
            console.log(`    列${i}: ${displayVal}`);
          }
        }
      }
    } catch (err) {
      console.error(`错误: ${err.message}`);
    }
  }
}

main().catch(console.error);
