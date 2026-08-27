// 构建时从飞书获取数据
// 运行：node scripts/fetch-feishu-data.js

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_aafb3dec53f89bea';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'T3LxeABJxhhqs8aCzM5ckdo2i1UfUHZd';
const FEISHU_SHEET_TOKEN = process.env.FEISHU_SHEET_TOKEN || 'LQd6dEfpTo4PZ0xNCiMcU74Tn2f';

async function getTenantAccessToken() {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET,
    }),
  });

  const data = await response.json();
  if (!data.tenant_access_token) {
    throw new Error('Failed to get tenant_access_token: ' + JSON.stringify(data));
  }
  return data.tenant_access_token;
}

async function fetchSheetData(token, sheetId) {
  // 获取所有 sheet
  const sheetsResponse = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetId}/sheets`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const sheetsData = await sheetsResponse.json();
  const sheets = sheetsData.data?.sheets || [];

  const allRecords = [];
  const roomList = [];

  for (const sheet of sheets) {
    const roomName = sheet.title;
    roomList.push(roomName);

    // 获取 sheet 数据
    const rangeResponse = await fetch(
      `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${sheetId}/sheets/${sheet.sheet_id}/values`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const rangeData = await rangeResponse.json();
    const values = rangeData.data?.values || [];

    if (values.length < 2) continue;

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

      const consume = consumeIdx >= 0 ? parseFloat(row[consumeIdx]) || 0 : 0;
      const premium = premiumIdx >= 0 ? parseFloat(row[premiumIdx]) || 0 : 0;
      const policies = policiesIdx >= 0 ? parseInt(row[policiesIdx]) || 0 : 0;
      const duration = durationIdx >= 0 ? parseFloat(row[durationIdx]) || 0 : 0;

      const record = {
        date: dateStr,
        room: roomName,
        streamer: streamerIdx >= 0 ? row[streamerIdx] : '',
        timeSlot: timeSlotIdx >= 0 ? row[timeSlotIdx] : '',
        consume,
        premium,
        policies,
        duration,
        roi: consume > 0 ? Math.round((premium / consume) * 100) / 100 : 0,
        timeCost: duration > 0 ? Math.round((consume / (duration / 60)) * 100) / 100 : 0,
      };

      allRecords.push(record);
    }
  }

  return { records: allRecords, rooms: roomList };
}

async function main() {
  try {
    console.log('Getting tenant access token...');
    const token = await getTenantAccessToken();

    console.log('Fetching sheet data...');
    const { records, rooms } = await fetchSheetData(token, FEISHU_SHEET_TOKEN);

    console.log(`Fetched ${records.length} records from ${rooms.length} rooms`);

    // 保存数据到 public/data 目录
    const fs = await import('fs');
    const path = await import('path');

    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dataFile = path.join(dataDir, 'livestream-data.json');
    fs.writeFileSync(dataFile, JSON.stringify({
      records,
      rooms,
      lastUpdate: new Date().toISOString(),
    }, null, 2));

    console.log(`Data saved to ${dataFile}`);
  } catch (error) {
    console.error('Error fetching Feishu data:', error.message);
    // 如果获取失败，创建空数据文件
    const fs = await import('fs');
    const path = await import('path');

    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dataFile = path.join(dataDir, 'livestream-data.json');
    fs.writeFileSync(dataFile, JSON.stringify({
      records: [],
      rooms: [],
      lastUpdate: new Date().toISOString(),
    }, null, 2));

    console.log('Empty data file created');
  }
}

main();
