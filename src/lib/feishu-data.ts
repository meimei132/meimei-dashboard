import type { SessionRecord } from './types';

// 飞书电子表格数据导入
// 支持从飞书表格读取直播间数据

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_aafb3dec53f89bea';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';
const FEISHU_SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'LQd6dEfpTo4PZ0xNCiMcU74Tn2f';

interface FeishuTokenResponse {
  tenant_access_token: string;
  expire: number;
}

interface FeishuSheetData {
  values: string[][];
}

let cachedToken: string | null = null;
let tokenExpireTime = 0;

async function getTenantAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpireTime) {
    return cachedToken;
  }

  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data: FeishuTokenResponse = await response.json();
  cachedToken = data.tenant_access_token;
  tokenExpireTime = Date.now() + (data.expire - 300) * 1000; // 提前 5 分钟刷新
  return cachedToken;
}

export async function fetchFeishuSheetData(sheetToken?: string): Promise<SessionRecord[]> {
  const token = await getTenantAccessToken();
  const sheetId = sheetToken || FEISHU_SHEET_TOKEN;

  // 获取电子表格的所有 sheet
  const sheetsResponse = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetId}/sheets`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const sheetsData = await sheetsResponse.json();
  const sheets: Array<{ sheet_id: string; title: string }> = sheetsData.data?.sheets || [];

  const allRecords: SessionRecord[] = [];

  // 遍历每个 sheet（每个直播间一个 sheet）
  for (const sheet of sheets) {
    const roomName = sheet.title;

    // 获取 sheet 的数据
    const rangeResponse = await fetch(
      `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetId}/sheets/${sheet.sheet_id}/values`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const rangeData: { data: { values: string[][] } } = await rangeResponse.json();
    const values = rangeData.data?.values || [];

    if (values.length < 2) continue; // 至少需要表头 + 1 行数据

    // 解析表头
    const headers = values[0].map(h => h.toLowerCase().trim());
    const dateIdx = headers.findIndex(h => h.includes('日期') || h.includes('date'));
    const streamerIdx = headers.findIndex(h => h.includes('主播') || h.includes('streamer'));
    const timeSlotIdx = headers.findIndex(h => h.includes('时段') || h.includes('time'));
    const consumeIdx = headers.findIndex(h => h.includes('消耗') || h.includes('consume'));
    const premiumIdx = headers.findIndex(h => h.includes('保费') || h.includes('premium'));
    const policiesIdx = headers.findIndex(h => h.includes('保单') || h.includes('policy'));
    const durationIdx = headers.findIndex(h => h.includes('时长') || h.includes('duration'));

    // 解析数据行
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row || row.length === 0) continue;

      const dateStr = dateIdx >= 0 ? row[dateIdx] : '';
      if (!dateStr) continue;

      const record: SessionRecord = {
        date: dateStr,
        room: roomName,
        streamer: streamerIdx >= 0 ? row[streamerIdx] : '',
        timeSlot: timeSlotIdx >= 0 ? row[timeSlotIdx] : '',
        consume: consumeIdx >= 0 ? parseFloat(row[consumeIdx]) || 0 : 0,
        premium: premiumIdx >= 0 ? parseFloat(row[premiumIdx]) || 0 : 0,
        policies: policiesIdx >= 0 ? parseInt(row[policiesIdx]) || 0 : 0,
        duration: durationIdx >= 0 ? parseFloat(row[durationIdx]) || 0 : 0,
        roi: 0,
        timeCost: 0,
      };

      // 计算 ROI 和时耗
      if (record.consume > 0) {
        record.roi = Math.round((record.premium / record.consume) * 100) / 100;
        record.timeCost = Math.round((record.consume / (record.duration / 60)) * 100) / 100;
      }

      allRecords.push(record);
    }
  }

  return allRecords;
}

// 导出获取房间列表的函数
export async function fetchRoomList(sheetToken?: string): Promise<string[]> {
  const token = await getTenantAccessToken();
  const sheetId = sheetToken || FEISHU_SHEET_TOKEN;

  const sheetsResponse = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetId}/sheets`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const sheetsData = await sheetsResponse.json();
  const sheets: Array<{ title: string }> = sheetsData.data?.sheets || [];

  return sheets.map(s => s.title);
}
