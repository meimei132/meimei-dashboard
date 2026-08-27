#!/usr/bin/env node
/**
 * 调试脚本：查看飞书表格的实际数据
 */

const APP_ID = 'cli_aafb3dec53f89bea';
const APP_SECRET = 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';

async function getTenantToken() {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await resp.json();
  return data.tenant_access_token;
}

async function getSheetData(token, spreadsheetToken, sheetId) {
  const resp = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  return data.data.valueRange.values;
}

async function main() {
  const token = await getTenantToken();
  
  // 查看第一个表格的前 10 行数据
  const tableToken = 'XjXjs4wjphBpSatmxH4cZVn2nMh';
  const sheetId = '27cTzT';
  
  const rows = await getSheetData(token, tableToken, sheetId);
  
  console.log('=== 平安健康-E生保 表格数据样本 ===');
  console.log(`总行数: ${rows.length}\n`);
  
  console.log('前 10 行数据:');
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log(`\n第 ${i} 行:`);
    const row = rows[i];
    for (let j = 0; j < row.length; j++) {
      console.log(`  列${j}: ${JSON.stringify(row[j])} (类型: ${typeof row[j]})`);
    }
  }
}

main().catch(console.error);
