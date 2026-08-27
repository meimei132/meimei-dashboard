import type { SessionRecord, RoomSummary, StreamerSummary, AlertItem, DailyTrend } from './types';
import { mockData } from './mock-data';

export function getData(): SessionRecord[] {
  return mockData;
}

export function filterByDate(data: SessionRecord[], date: string): SessionRecord[] {
  return data.filter(r => r.date === date);
}

export function filterByMonth(data: SessionRecord[], month: string): SessionRecord[] {
  return data.filter(r => r.date.startsWith(month));
}

export function filterByRoom(data: SessionRecord[], room: string): SessionRecord[] {
  return data.filter(r => r.room === room);
}

export function getLatestDate(data: SessionRecord[]): string {
  return data.reduce((latest, r) => {
    const normalizedR = normalizeDateForCompare(r.date);
    const normalizedLatest = normalizeDateForCompare(latest);
    return normalizedR > normalizedLatest ? r.date : latest;
  }, '');
}

// 标准化日期为 YYYY-MM-DD 格式（用于比较）
export function normalizeDateForCompare(dateStr: string): string {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 获取昨天的日期（基于数据中最新日期）
export function getYesterdayDate(data: SessionRecord[]): string {
  const latestDate = getLatestDate(data);
  if (!latestDate) return '';
  
  // 解析日期格式 2026.8.9
  const parts = latestDate.split('.');
  if (parts.length !== 3) return latestDate;
  
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  
  // 计算昨天
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  
  return `${y}.${m}.${d}`;
}

// 过滤数据，只保留到昨天（基于数据中最新日期）
export function filterUpToYesterday(data: SessionRecord[]): SessionRecord[] {
  const yesterday = getYesterdayDate(data);
  if (!yesterday) return data;
  
  const yesterdayNormalized = normalizeDateForCompare(yesterday);
  
  return data.filter(r => {
    const normalized = normalizeDateForCompare(r.date);
    return normalized <= yesterdayNormalized;
  });
}

export function getMonthKey(date?: string): string {
  const d = date ? new Date(date) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function aggregateRooms(data: SessionRecord[]): RoomSummary[] {
  const map = new Map<string, SessionRecord[]>();
  for (const r of data) {
    if (!map.has(r.room)) map.set(r.room, []);
    map.get(r.room)!.push(r);
  }

  return Array.from(map.entries()).map(([room, records]) => {
    const totalConsume = records.reduce((s, r) => s + r.consume, 0);
    const totalPremium = records.reduce((s, r) => s + r.premium, 0);
    const totalPolicies = records.reduce((s, r) => s + r.policies, 0);
    const totalDuration = records.reduce((s, r) => s + r.duration, 0);
    const streamers = new Set(records.map(r => r.streamer));
    return {
      room,
      totalConsume: Math.round(totalConsume * 100) / 100,
      totalPremium: Math.round(totalPremium * 100) / 100,
      totalPolicies,
      totalDuration,
      avgRoi: totalConsume > 0 ? Math.round((totalPremium / totalConsume) * 100) / 100 : 0,
      avgTimeCost: totalDuration > 0 ? Math.round((totalConsume / (totalDuration / 60)) * 100) / 100 : 0,
      streamerCount: streamers.size,
    };
  });
}

export function aggregateStreamers(data: SessionRecord[]): StreamerSummary[] {
  const map = new Map<string, SessionRecord[]>();
  for (const r of data) {
    const key = `${r.streamer}|||${r.room}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  return Array.from(map.entries()).map(([, records]) => {
    const first = records[0];
    const totalConsume = records.reduce((s, r) => s + r.consume, 0);
    const totalPremium = records.reduce((s, r) => s + r.premium, 0);
    const totalPolicies = records.reduce((s, r) => s + r.policies, 0);
    const totalDuration = records.reduce((s, r) => s + r.duration, 0);
    return {
      streamer: first.streamer,
      room: first.room,
      totalConsume: Math.round(totalConsume * 100) / 100,
      totalPremium: Math.round(totalPremium * 100) / 100,
      totalPolicies,
      totalDuration,
      avgRoi: totalConsume > 0 ? Math.round((totalPremium / totalConsume) * 100) / 100 : 0,
      avgTimeCost: totalDuration > 0 ? Math.round((totalConsume / (totalDuration / 60)) * 100) / 100 : 0,
      sessionCount: records.length,
    };
  });
}

export function getDailyTrend(data: SessionRecord[], room?: string): DailyTrend[];
export function getDailyTrend(data: SessionRecord[], metric: string): { date: string; value: number }[];
export function getDailyTrend(data: SessionRecord[], roomOrMetric?: string): DailyTrend[] | { date: string; value: number }[] {
  const metrics = ['roi', 'timeCost', 'consume', 'premium', 'policies', 'duration'];
  const isMetric = roomOrMetric && metrics.includes(roomOrMetric);
  
  const filtered = (!isMetric && roomOrMetric) ? data.filter(r => r.room === roomOrMetric) : data;
  const map = new Map<string, SessionRecord[]>();
  for (const r of filtered) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date)!.push(r);
  }

  const trends = Array.from(map.entries())
    .sort(([a], [b]) => normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b)))
    .map(([date, records]) => {
      const consume = records.reduce((s, r) => s + r.consume, 0);
      const premium = records.reduce((s, r) => s + r.premium, 0);
      const policies = records.reduce((s, r) => s + r.policies, 0);
      const duration = records.reduce((s, r) => s + r.duration, 0);
      return {
        date,
        consume: Math.round(consume),
        premium: Math.round(premium),
        policies,
        duration,
        roi: consume > 0 ? Math.round((premium / consume) * 100) / 100 : 0,
        timeCost: duration > 0 ? Math.round((consume / (duration / 60)) * 100) / 100 : 0,
      };
    });

  if (isMetric && roomOrMetric) {
    const metric = roomOrMetric as keyof DailyTrend;
    return trends.map(t => ({ date: t.date, value: t[metric] as number }));
  }
  return trends;
}

export function detectAlerts(data: SessionRecord[], days: number = 3): AlertItem[] {
  const alerts: AlertItem[] = [];
  const latestDate = getLatestDate(data);
  const latestNorm = normalizeDateForCompare(latestDate);
  
  // 获取最近N天的日期列表
  const allDates = [...new Set(data.map(r => r.date))].sort((a, b) => 
    normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b))
  );
  const recentDates = allDates.slice(-days);
  
  if (recentDates.length < days) return alerts;

  // 辅助函数：检查最后活跃日期是否在最近N天内
  const isActiveRecently = (records: SessionRecord[]): boolean => {
    const lastActiveDate = records.reduce((latest, r) => {
      const rNorm = normalizeDateForCompare(r.date);
      return rNorm > latest ? rNorm : latest;
    }, '');
    // 计算与最新日期的间隔天数
    const lastDate = new Date(lastActiveDate.replace(/\./g, '-'));
    const latest = new Date(latestNorm);
    const diffDays = Math.floor((latest.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  };

  // 只检测最近N天有数据的直播间
  const rooms = [...new Set(data.filter(r => recentDates.includes(r.date)).map(r => r.room))];
  for (const room of rooms) {
    const roomData = data.filter(r => r.room === room);
    
    // 检查活跃度
    if (!isActiveRecently(roomData)) continue;
    
    const dailyTrend = getDailyTrend(roomData);

    // Check last N days
    if (dailyTrend.length >= days) {
      const lastN = dailyTrend.slice(-days);
      
      // ROI declining (坏消息)
      const roiDeclining = lastN.every((d, i) => i === 0 || d.roi <= lastN[i - 1].roi);
      if (roiDeclining && lastN[0].roi > 0) {
        const drop = ((lastN[0].roi - lastN[lastN.length - 1].roi) / lastN[0].roi) * 100;
        alerts.push({
          type: 'room', name: room, metric: 'roi', metricLabel: 'ROI',
          days, trend: lastN.map(d => d.roi),
          severity: drop >= 30 ? 'critical' : 'warning',
          direction: 'down',
          changePercent: Math.round(drop * 10) / 10,
        });
      }

      // ROI rising (好消息)
      const roiRising = lastN.every((d, i) => i === 0 || d.roi >= lastN[i - 1].roi);
      if (roiRising && lastN[0].roi > 0) {
        const rise = ((lastN[lastN.length - 1].roi - lastN[0].roi) / lastN[0].roi) * 100;
        alerts.push({
          type: 'room', name: room, metric: 'roi', metricLabel: 'ROI',
          days, trend: lastN.map(d => d.roi),
          severity: rise >= 30 ? 'critical' : 'warning',
          direction: 'up',
          changePercent: Math.round(rise * 10) / 10,
        });
      }

      // TimeCost increasing (好消息 - 效率提高)
      const tcIncreasing = lastN.every((d, i) => i === 0 || d.timeCost >= lastN[i - 1].timeCost);
      if (tcIncreasing && lastN[0].timeCost > 0) {
        const rise = ((lastN[lastN.length - 1].timeCost - lastN[0].timeCost) / lastN[0].timeCost) * 100;
        alerts.push({
          type: 'room', name: room, metric: 'timeCost', metricLabel: '时耗',
          days, trend: lastN.map(d => d.timeCost),
          severity: rise >= 30 ? 'critical' : 'warning',
          direction: 'up', // 时耗上升 = 好消息
          changePercent: Math.round(rise * 10) / 10,
        });
      }

      // TimeCost decreasing (坏消息 - 效率降低)
      const tcDecreasing = lastN.every((d, i) => i === 0 || d.timeCost <= lastN[i - 1].timeCost);
      if (tcDecreasing && lastN[0].timeCost > 0) {
        const drop = ((lastN[0].timeCost - lastN[lastN.length - 1].timeCost) / lastN[0].timeCost) * 100;
        alerts.push({
          type: 'room', name: room, metric: 'timeCost', metricLabel: '时耗',
          days, trend: lastN.map(d => d.timeCost),
          severity: drop >= 30 ? 'critical' : 'warning',
          direction: 'down', // 时耗下降 = 坏消息
          changePercent: Math.round(drop * 10) / 10,
        });
      }
    }
  }

  // 只检测最近N天有数据的主播
  const streamerKeys = [...new Set(data.filter(r => recentDates.includes(r.date)).map(r => `${r.streamer}|||${r.room}`))];
  for (const key of streamerKeys) {
    const [streamer, room] = key.split('|||');
    const sData = data.filter(r => r.streamer === streamer && r.room === room);
    
    // 检查活跃度
    if (!isActiveRecently(sData)) continue;
    
    const dailyTrend = getDailyTrend(sData);

    if (dailyTrend.length >= days) {
      const lastN = dailyTrend.slice(-days);
      
      // ROI declining (坏消息)
      const roiDeclining = lastN.every((d, i) => i === 0 || d.roi <= lastN[i - 1].roi);
      if (roiDeclining && lastN[0].roi > 0) {
        const drop = ((lastN[0].roi - lastN[lastN.length - 1].roi) / lastN[0].roi) * 100;
        alerts.push({
          type: 'streamer', name: streamer, room, metric: 'roi', metricLabel: 'ROI',
          days, trend: lastN.map(d => d.roi),
          severity: drop >= 30 ? 'critical' : 'warning',
          direction: 'down',
          changePercent: Math.round(drop * 10) / 10,
        });
      }

      // ROI rising (好消息)
      const roiRising = lastN.every((d, i) => i === 0 || d.roi >= lastN[i - 1].roi);
      if (roiRising && lastN[0].roi > 0) {
        const rise = ((lastN[lastN.length - 1].roi - lastN[0].roi) / lastN[0].roi) * 100;
        alerts.push({
          type: 'streamer', name: streamer, room, metric: 'roi', metricLabel: 'ROI',
          days, trend: lastN.map(d => d.roi),
          severity: rise >= 30 ? 'critical' : 'warning',
          direction: 'up',
          changePercent: Math.round(rise * 10) / 10,
        });
      }

      // TimeCost increasing (好消息 - 效率提高)
      const tcIncreasing = lastN.every((d, i) => i === 0 || d.timeCost >= lastN[i - 1].timeCost);
      if (tcIncreasing && lastN[0].timeCost > 0) {
        const rise = ((lastN[lastN.length - 1].timeCost - lastN[0].timeCost) / lastN[0].timeCost) * 100;
        alerts.push({
          type: 'streamer', name: streamer, room, metric: 'timeCost', metricLabel: '时耗',
          days, trend: lastN.map(d => d.timeCost),
          severity: rise >= 30 ? 'critical' : 'warning',
          direction: 'up', // 时耗上升 = 好消息
          changePercent: Math.round(rise * 10) / 10,
        });
      }

      // TimeCost decreasing (坏消息 - 效率降低)
      const tcDecreasing = lastN.every((d, i) => i === 0 || d.timeCost <= lastN[i - 1].timeCost);
      if (tcDecreasing && lastN[0].timeCost > 0) {
        const drop = ((lastN[0].timeCost - lastN[lastN.length - 1].timeCost) / lastN[0].timeCost) * 100;
        alerts.push({
          type: 'streamer', name: streamer, room, metric: 'timeCost', metricLabel: '时耗',
          days, trend: lastN.map(d => d.timeCost),
          severity: drop >= 30 ? 'critical' : 'warning',
          direction: 'down', // 时耗下降 = 坏消息
          changePercent: Math.round(drop * 10) / 10,
        });
      }
    }
  }

  return alerts;
}

export function aggregateRecords(data: SessionRecord[]): {
  totalConsume: number; totalPremium: number; totalPolicies: number;
  totalDuration: number; avgRoi: number; avgTimeCost: number;
} {
  const totalConsume = data.reduce((s, r) => s + r.consume, 0);
  const totalPremium = data.reduce((s, r) => s + r.premium, 0);
  const totalPolicies = data.reduce((s, r) => s + r.policies, 0);
  const totalDuration = data.reduce((s, r) => s + r.duration, 0);
  return {
    totalConsume: Math.round(totalConsume * 100) / 100,
    totalPremium: Math.round(totalPremium * 100) / 100,
    totalPolicies,
    totalDuration,
    avgRoi: totalConsume > 0 ? Math.round((totalPremium / totalConsume) * 100) / 100 : 0,
    avgTimeCost: totalDuration > 0 ? Math.round((totalConsume / (totalDuration / 60)) * 100) / 100 : 0,
  };
}

export function getAlerts(data: SessionRecord[], level: "room" | "streamer"): AlertItem[] {
  const all = detectAlerts(data);
  return all.filter(a => a.type === level);
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

export function formatCurrency(n: number): string {
  return '¥' + Math.round(n).toLocaleString('zh-CN');
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// 环比分析：计算环比变化率
export function calcChangeRate(current: number, previous: number): { rate: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { rate: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'flat' };
  const rate = ((current - previous) / previous) * 100;
  return {
    rate: Math.round(rate * 10) / 10,
    direction: rate > 0.5 ? 'up' : rate < -0.5 ? 'down' : 'flat',
  };
}

// 格式化日期为 YYYY-MM-DD
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取指定日期所在周的起止日期（周一到周日）
function getWeekRange(dateStr: string): { start: string; end: string } {
  // 先标准化日期格式，确保 new Date() 能正确解析
  const normalizedDate = normalizeDateForCompare(dateStr);
  const d = new Date(normalizedDate);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // 周一为起始
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

// 获取上个月的月份字符串
function getPrevMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const prev = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return `${prevYear}-${String(prev).padStart(2, '0')}`;
}

// 获取上周的日期范围
function getPrevWeekRange(weekStart: string): { start: string; end: string } {
  const normalizedDate = normalizeDateForCompare(weekStart);
  const d = new Date(normalizedDate);
  d.setDate(d.getDate() - 7);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return {
    start: formatDate(d),
    end: formatDate(end),
  };
}

// 标准化日期为 YYYY-MM 格式（处理 "2026.8.1" 和 "2026-08-01" 两种格式）
export function normalizeMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 检查日期是否属于指定月份
export function isDateInMonth(dateStr: string, monthStr: string): boolean {
  return normalizeMonth(dateStr) === monthStr;
}

// 环比上月数据
export function getMonthOverMonth(data: SessionRecord[], currentMonth: string) {
  const prevMonth = getPrevMonth(currentMonth);
  const currentData = data.filter(r => isDateInMonth(r.date, currentMonth));
  const prevData = data.filter(r => isDateInMonth(r.date, prevMonth));
  
  const current = aggregateRecords(currentData);
  const prev = aggregateRecords(prevData);
  
  return {
    consume: calcChangeRate(current.totalConsume, prev.totalConsume),
    premium: calcChangeRate(current.totalPremium, prev.totalPremium),
    policies: calcChangeRate(current.totalPolicies, prev.totalPolicies),
    duration: calcChangeRate(current.totalDuration, prev.totalDuration),
    roi: calcChangeRate(current.avgRoi, prev.avgRoi),
    timeCost: calcChangeRate(current.avgTimeCost, prev.avgTimeCost),
    currentMonth,
    prevMonth,
    current,
    prev,
  };
}

// 环比上周数据
export function getWeekOverWeek(data: SessionRecord[], latestDate: string) {
  const currentWeek = getWeekRange(latestDate);
  const prevWeek = getPrevWeekRange(currentWeek.start);
  
  const currentData = data.filter(r => {
    const normalized = normalizeDateForCompare(r.date);
    return normalized >= currentWeek.start && normalized <= currentWeek.end;
  });
  const prevData = data.filter(r => {
    const normalized = normalizeDateForCompare(r.date);
    return normalized >= prevWeek.start && normalized <= prevWeek.end;
  });
  
  const current = aggregateRecords(currentData);
  const prev = aggregateRecords(prevData);
  
  return {
    consume: calcChangeRate(current.totalConsume, prev.totalConsume),
    premium: calcChangeRate(current.totalPremium, prev.totalPremium),
    policies: calcChangeRate(current.totalPolicies, prev.totalPolicies),
    duration: calcChangeRate(current.totalDuration, prev.totalDuration),
    roi: calcChangeRate(current.avgRoi, prev.avgRoi),
    timeCost: calcChangeRate(current.avgTimeCost, prev.avgTimeCost),
    currentWeek: `${currentWeek.start} ~ ${currentWeek.end}`,
    prevWeek: `${prevWeek.start} ~ ${prevWeek.end}`,
    current,
    prev,
  };
}
