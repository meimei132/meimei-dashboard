"use client";

import { useState, useMemo, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { mockData as records } from "@/lib/mock-data";
import { aggregateRecords, getDailyTrend, getLatestDate, getMonthKey, getMonthOverMonth, getWeekOverWeek, isDateInMonth, filterUpToYesterday, normalizeDateForCompare, getAlerts } from "@/lib/data-utils";
import type { SessionRecord } from "@/lib/types";
import RoomBubbleChart from "@/components/RoomBubbleChart";
import AlertBanner from "@/components/AlertBanner";

const METRIC_OPTIONS = [
  { key: "totalConsume", label: "消耗" },
  { key: "totalPremium", label: "保费" },
  { key: "avgRoi", label: "ROI" },
  { key: "avgTimeCost", label: "时耗" },
] as const;

function ChangeBadge({ rate, direction, inverse }: { rate: number; direction: 'up' | 'down' | 'flat'; inverse?: boolean }) {
  if (direction === 'flat') return <span className="text-gray-500">-</span>;
  const isGood = inverse ? direction === 'up' : direction === 'down';
  const color = isGood ? 'text-emerald-400' : 'text-red-400';
  const arrow = direction === 'up' ? '↑' : '↓';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {Math.abs(rate)}%
    </span>
  );
}

function StatCard({ title, value, color, mom, wow, inverse }: {
  title: string; value: string; color: string;
  mom?: { rate: number; direction: 'up' | 'down' | 'flat' };
  wow?: { rate: number; direction: 'up' | 'down' | 'flat' };
  inverse?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
        {mom && (
          <span className="flex items-center gap-1">
            <span className="text-gray-500">月环比</span>
            <ChangeBadge rate={mom.rate} direction={mom.direction} inverse={inverse} />
          </span>
        )}
        {wow && (
          <span className="flex items-center gap-1">
            <span className="text-gray-500">周环比</span>
            <ChangeBadge rate={wow.rate} direction={wow.direction} inverse={inverse} />
          </span>
        )}
      </div>
    </div>
  );
}

function TrendChart({ data, title, color }: { data: { date: string; value: number }[]; title: string; color: string }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <h4 className="mb-3 text-sm font-medium text-gray-300">{title}</h4>
        <div className="flex h-32 items-center justify-center text-xs text-gray-500">
          暂无数据
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <h4 className="mb-3 text-sm font-medium text-gray-300">{title}</h4>
      <ReactECharts
        option={{
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#e2e8f0', fontSize: 12 },
          },
          grid: { left: 50, right: 10, top: 10, bottom: 20 },
          xAxis: {
            type: 'category',
            data: data.map(d => d.date),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 9, rotate: data.length > 15 ? 45 : 0 },
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 10 },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          series: [{
            type: 'line',
            data: data.map(d => d.value),
            smooth: true,
            symbol: 'circle',
            symbolSize: 4,
            lineStyle: { width: 2, color },
            itemStyle: { color },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: color + '40' },
                  { offset: 1, color: color + '05' },
                ],
              },
            },
          }],
        }}
        style={{ height: 160 }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

function RoomSection({ room, records, currentMonth, dataUpdateDate }: { 
  room: string; 
  records: SessionRecord[]; 
  currentMonth: string;
  dataUpdateDate: string;
}) {
  const [rankMetric, setRankMetric] = useState<string>("consume");
  const [rankTimeView, setRankTimeView] = useState<string>("day");
  const [trendDateRange, setTrendDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // 使用所有数据（不过滤）
  const filteredRecords = records;
  
  // 使用最新日期作为"昨日"
  const yesterdayDate = useMemo(() => getLatestDate(records), [records]);

  // 初始化趋势图日期范围
  const trendDateRangeInit = useMemo(() => {
    const allDates = [...new Set(filteredRecords.map(r => r.date))].sort((a, b) => 
      normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b))
    );
    const monthPrefix = currentMonth;
    const currentMonthDates = allDates.filter(d => {
      const normalized = normalizeDateForCompare(d);
      return normalized.startsWith(monthPrefix);
    });
    if (currentMonthDates.length > 0) {
      return { 
        start: normalizeDateForCompare(currentMonthDates[0]), 
        end: normalizeDateForCompare(currentMonthDates[currentMonthDates.length - 1]) 
      };
    }
    return { 
      start: allDates[0] ? normalizeDateForCompare(allDates[0]) : '', 
      end: allDates[allDates.length - 1] ? normalizeDateForCompare(allDates[allDates.length - 1]) : '' 
    };
  }, [filteredRecords, currentMonth]);

  const [trendDateRangeInitialized, setTrendDateRangeInitialized] = useState(false);
  if (!trendDateRangeInitialized && trendDateRangeInit.start) {
    setTrendDateRange(trendDateRangeInit);
    setTrendDateRangeInitialized(true);
  }

  // 当月数据
  const monthlyData = useMemo(() => filteredRecords.filter(r => isDateInMonth(r.date, currentMonth)), [filteredRecords, currentMonth]);
  const monthlyAgg = useMemo(() => aggregateRecords(monthlyData), [monthlyData]);

  // 月环比
  const mom = useMemo(() => getMonthOverMonth(filteredRecords, currentMonth), [filteredRecords, currentMonth]);
  // 周环比
  const wow = useMemo(() => getWeekOverWeek(filteredRecords, yesterdayDate), [filteredRecords, yesterdayDate]);
  const monthlyByStreamer = useMemo(() => {
    const monthlyRecs = filteredRecords.filter(r => isDateInMonth(r.date, currentMonth));
    const map = new Map<string, SessionRecord[]>();
    for (const r of monthlyRecs) {
      if (!r.streamer || r.streamer.trim() === '') continue;
      const arr = map.get(r.streamer) || [];
      arr.push(r);
      map.set(r.streamer, arr);
    }
    return Array.from(map.entries()).map(([streamer, recs]) => ({
      streamer,
      ...aggregateRecords(recs),
    }));
  }, [filteredRecords, currentMonth]);

  // 按主播分组 - 昨日
  const yesterdayByStreamer = useMemo(() => {
    const yesterdayRecs = filteredRecords.filter(r => r.date === yesterdayDate);
    const map = new Map<string, SessionRecord[]>();
    for (const r of yesterdayRecs) {
      if (!r.streamer || r.streamer.trim() === '') continue;
      const arr = map.get(r.streamer) || [];
      arr.push(r);
      map.set(r.streamer, arr);
    }
    return Array.from(map.entries()).map(([streamer, recs]) => ({
      streamer,
      ...aggregateRecords(recs),
    }));
  }, [yesterdayDate]);

  // 主播排名
  const rankedStreamers = useMemo(() => {
    const data = rankTimeView === "month" ? monthlyByStreamer : yesterdayByStreamer;
    const key = rankMetric as keyof typeof data[0];
    return [...data].sort((a, b) => Number(b[key]) - Number(a[key]));
  }, [monthlyByStreamer, yesterdayByStreamer, rankMetric, rankTimeView]);

  // 趋势数据
  const trendFilteredRecords = useMemo(() => {
    if (!trendDateRange.start || !trendDateRange.end) return filteredRecords;
    const startNorm = normalizeDateForCompare(trendDateRange.start);
    const endNorm = normalizeDateForCompare(trendDateRange.end);
    return filteredRecords.filter(r => {
      const rNorm = normalizeDateForCompare(r.date);
      return rNorm >= startNorm && rNorm <= endNorm;
    });
  }, [filteredRecords, trendDateRange]);

  const dailyTrendRaw = useMemo(() => getDailyTrend(trendFilteredRecords), [trendFilteredRecords]);
  const roiTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.roi })) : [];
  const timeCostTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.timeCost })) : [];
  const consumeTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.consume })) : [];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      {/* 直播间标题 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-cyan-400">{room}</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          数据更新：{dataUpdateDate}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="本月总消耗"
          value={Math.round(monthlyAgg.totalConsume).toLocaleString('zh-CN')}
          color="text-cyan-400"
          mom={mom.consume}
          wow={wow.consume}
        />
        <StatCard
          title="本月总保费"
          value={Math.round(monthlyAgg.totalPremium).toLocaleString('zh-CN')}
          color="text-emerald-400"
          mom={mom.premium}
          wow={wow.premium}
          inverse
        />
        <StatCard
          title="本月保单数"
          value={monthlyAgg.totalPolicies.toLocaleString()}
          color="text-blue-400"
          mom={mom.policies}
          wow={wow.policies}
          inverse
        />
        <StatCard
          title="本月总时长"
          value={`${Math.round(monthlyAgg.totalDuration / 60)}h`}
          color="text-purple-400"
          mom={mom.duration}
          wow={wow.duration}
          inverse
        />
        <StatCard
          title="平均ROI"
          value={monthlyAgg.avgRoi.toFixed(2)}
          color="text-amber-400"
          mom={mom.roi}
          wow={wow.roi}
          inverse
        />
        <StatCard
          title="平均时耗"
          value={monthlyAgg.avgTimeCost.toFixed(2)}
          color="text-pink-400"
          mom={mom.timeCost}
          wow={wow.timeCost}
        />
      </div>

      {/* 趋势图 */}
      <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">趋势分析</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={trendDateRange.start}
              onChange={(e) => setTrendDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-xs text-gray-500">~</span>
            <input
              type="date"
              value={trendDateRange.end}
              onChange={(e) => setTrendDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={() => setTrendDateRange(trendDateRangeInit)}
              className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              当月
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <TrendChart data={consumeTrend} title="每日消耗趋势" color="#22d3ee" />
          <TrendChart data={roiTrend} title="ROI 趋势" color="#fbbf24" />
          <TrendChart data={timeCostTrend} title="时耗趋势" color="#f472b6" />
        </div>
      </div>

      {/* 主播排名 */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-200">
              {rankTimeView === "month" ? "分月主播排名" : "昨日主播排名"}
            </h3>
            <p className="text-xs text-gray-500">
              {rankTimeView === "month" ? `${currentMonth} · ${rankedStreamers.length}位主播` : `${yesterdayDate} · ${rankedStreamers.length}位主播`}
            </p>
          </div>
          <div className="flex gap-1.5">
            <div className="flex rounded-md bg-gray-800 p-0.5">
              <button
                onClick={() => setRankTimeView("month")}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  rankTimeView === "month" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                分月
              </button>
              <button
                onClick={() => setRankTimeView("day")}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  rankTimeView === "day" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                昨日
              </button>
            </div>
            <div className="flex gap-1">
              {METRIC_OPTIONS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setRankMetric(m.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    rankMetric === m.key ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="pb-2 text-left font-medium">排名</th>
                <th className="pb-2 text-left font-medium">主播</th>
                <th className="pb-2 text-right font-medium">消耗</th>
                <th className="pb-2 text-right font-medium">保费</th>
                <th className="pb-2 text-right font-medium">保单数</th>
                <th className="pb-2 text-right font-medium">时长(h)</th>
                <th className="pb-2 text-right font-medium">ROI</th>
                <th className="pb-2 text-right font-medium">时耗</th>
              </tr>
            </thead>
            <tbody>
              {rankedStreamers.map((r, i) => (
                <tr key={r.streamer} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                      i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-gray-400/20 text-gray-300" : i === 2 ? "bg-orange-500/20 text-orange-400" : "text-gray-500"
                    }`}>{i + 1}</span>
                  </td>
                  <td className="py-2 font-medium text-gray-200">{r.streamer}</td>
                  <td className="py-2 text-right text-cyan-400">{Math.round(r.totalConsume).toLocaleString('zh-CN')}</td>
                  <td className="py-2 text-right text-emerald-400">{Math.round(r.totalPremium).toLocaleString('zh-CN')}</td>
                  <td className="py-2 text-right text-blue-400">{r.totalPolicies}</td>
                  <td className="py-2 text-right text-purple-400">{(r.totalDuration / 60).toFixed(2)}</td>
                  <td className="py-2 text-right text-amber-400">{r.avgRoi.toFixed(2)}</td>
                  <td className="py-2 text-right text-pink-400">{r.avgTimeCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [viewMode, setViewMode] = useState<'all' | 'byRoom'>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  
  // 初始化 selectedRoom 为第一个直播间
  const roomList = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const r of records) {
      if (!r.room || r.room.trim() === '') continue;
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.keys());
  }, []);
  
  useEffect(() => {
    if (!selectedRoom && roomList.length > 0) {
      setSelectedRoom(roomList[0]);
    }
  }, [roomList, selectedRoom]);
  
  // 使用所有数据（不过滤）
  const filteredRecords = records;
  
  // 使用最新日期作为"昨日"
  const yesterdayDate = useMemo(() => getLatestDate(records), [records]);
  
  // 使用原始数据的最新日期作为数据更新时间
  const latestDate = useMemo(() => getLatestDate(records), [records]);
  
  const currentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  // 按直播间分组
  const recordsByRoom = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const r of filteredRecords) {
      if (!r.room || r.room.trim() === '') continue;
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.entries());
  }, [filteredRecords]);

  // 全部汇总数据
  const monthlyData = useMemo(() => filteredRecords.filter(r => isDateInMonth(r.date, currentMonth)), [filteredRecords, currentMonth]);
  const monthlyAgg = useMemo(() => aggregateRecords(monthlyData), [monthlyData]);
  const mom = useMemo(() => getMonthOverMonth(filteredRecords, currentMonth), [filteredRecords, currentMonth]);
  const wow = useMemo(() => getWeekOverWeek(filteredRecords, yesterdayDate), [filteredRecords, yesterdayDate]);

  // 预警数据（直播间级别）
  const roomAlerts = useMemo(() => getAlerts(filteredRecords, "room"), [filteredRecords]);

  // 全部汇总 - 按直播间分组
  const monthlyByRoom = useMemo(() => {
    const monthlyRecs = filteredRecords.filter(r => isDateInMonth(r.date, currentMonth));
    const map = new Map<string, SessionRecord[]>();
    for (const r of monthlyRecs) {
      if (!r.room || r.room.trim() === '') continue;
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.entries()).map(([room, recs]) => ({
      room,
      ...aggregateRecords(recs),
    }));
  }, [filteredRecords, currentMonth]);

  const yesterdayByRoom = useMemo(() => {
    const yesterdayRecs = filteredRecords.filter(r => r.date === yesterdayDate);
    const map = new Map<string, SessionRecord[]>();
    for (const r of yesterdayRecs) {
      if (!r.room || r.room.trim() === '') continue;
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.entries()).map(([room, recs]) => ({
      room,
      ...aggregateRecords(recs),
    }));
  }, [yesterdayDate]);

  const [rankMetric, setRankMetric] = useState<string>("consume");
  const [rankTimeView, setRankTimeView] = useState<string>("month");

  const rankedRooms = useMemo(() => {
    const data = rankTimeView === "month" ? monthlyByRoom : yesterdayByRoom;
    const key = rankMetric as keyof typeof data[0];
    return [...data].sort((a, b) => Number(b[key]) - Number(a[key]));
  }, [monthlyByRoom, yesterdayByRoom, rankMetric, rankTimeView]);

  // 全部汇总 - 趋势数据
  const [trendDateRange, setTrendDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const trendDateRangeInit = useMemo(() => {
    const allDates = [...new Set(filteredRecords.map(r => r.date))].sort((a, b) => 
      normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b))
    );
    const monthPrefix = currentMonth;
    const currentMonthDates = allDates.filter(d => {
      const normalized = normalizeDateForCompare(d);
      return normalized.startsWith(monthPrefix);
    });
    if (currentMonthDates.length > 0) {
      return { 
        start: normalizeDateForCompare(currentMonthDates[0]), 
        end: normalizeDateForCompare(currentMonthDates[currentMonthDates.length - 1]) 
      };
    }
    return { 
      start: allDates[0] ? normalizeDateForCompare(allDates[0]) : '', 
      end: allDates[allDates.length - 1] ? normalizeDateForCompare(allDates[allDates.length - 1]) : '' 
    };
  }, [filteredRecords, currentMonth]);

  const [trendDateRangeInitialized, setTrendDateRangeInitialized] = useState(false);
  if (!trendDateRangeInitialized && trendDateRangeInit.start) {
    setTrendDateRange(trendDateRangeInit);
    setTrendDateRangeInitialized(true);
  }

  const trendFilteredRecords = useMemo(() => {
    if (!trendDateRange.start || !trendDateRange.end) return filteredRecords;
    const startNorm = normalizeDateForCompare(trendDateRange.start);
    const endNorm = normalizeDateForCompare(trendDateRange.end);
    return filteredRecords.filter(r => {
      const rNorm = normalizeDateForCompare(r.date);
      return rNorm >= startNorm && rNorm <= endNorm;
    });
  }, [filteredRecords, trendDateRange]);

  const dailyTrendRaw = useMemo(() => getDailyTrend(trendFilteredRecords), [trendFilteredRecords]);
  const roiTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.roi })) : [];
  const timeCostTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.timeCost })) : [];
  const consumeTrend = Array.isArray(dailyTrendRaw) ? dailyTrendRaw.map(t => ({ date: t.date, value: t.consume })) : [];

  return (
    <div className="space-y-4">
      {/* 页面标题和视图切换 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">直播数据总览</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md bg-gray-800 p-0.5">
            <button
              onClick={() => setViewMode('all')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'all' ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              全部汇总
            </button>
            <button
              onClick={() => setViewMode('byRoom')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'byRoom' ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              分直播间
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            数据更新：{latestDate}
          </div>
        </div>
      </div>

      {viewMode === 'all' ? (
        // 全部汇总视图
        <>
          {/* 预警和积极信号 */}
          <AlertBanner alerts={roomAlerts} />

          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="本月总消耗"
              value={Math.round(monthlyAgg.totalConsume).toLocaleString('zh-CN')}
              color="text-cyan-400"
              mom={mom.consume}
              wow={wow.consume}
            />
            <StatCard
              title="本月总保费"
              value={Math.round(monthlyAgg.totalPremium).toLocaleString('zh-CN')}
              color="text-emerald-400"
              mom={mom.premium}
              wow={wow.premium}
              inverse
            />
            <StatCard
              title="本月保单数"
              value={monthlyAgg.totalPolicies.toLocaleString()}
              color="text-blue-400"
              mom={mom.policies}
              wow={wow.policies}
              inverse
            />
            <StatCard
              title="本月总时长"
              value={`${Math.round(monthlyAgg.totalDuration / 60)}h`}
              color="text-purple-400"
              mom={mom.duration}
              wow={wow.duration}
              inverse
            />
            <StatCard
              title="平均ROI"
              value={monthlyAgg.avgRoi.toFixed(2)}
              color="text-amber-400"
              mom={mom.roi}
              wow={wow.roi}
              inverse
            />
            <StatCard
              title="平均时耗"
              value={monthlyAgg.avgTimeCost.toFixed(2)}
              color="text-pink-400"
              mom={mom.timeCost}
              wow={wow.timeCost}
            />
          </div>

          {/* 趋势图 */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">趋势分析</h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={trendDateRange.start}
                  onChange={(e) => setTrendDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
                />
                <span className="text-xs text-gray-500">~</span>
                <input
                  type="date"
                  value={trendDateRange.end}
                  onChange={(e) => setTrendDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onClick={() => setTrendDateRange(trendDateRangeInit)}
                  className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  当月
                </button>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <TrendChart data={consumeTrend} title="每日消耗趋势" color="#22d3ee" />
              <TrendChart data={roiTrend} title="ROI 趋势" color="#fbbf24" />
              <TrendChart data={timeCostTrend} title="时耗趋势" color="#f472b6" />
            </div>
          </div>

          {/* 直播间排名 */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">
                  {rankTimeView === "month" ? "分月直播间排名" : "昨日直播间排名"}
                </h3>
                <p className="text-xs text-gray-500">
                  {rankTimeView === "month" ? `${currentMonth} · ${rankedRooms.length}个直播间` : `${yesterdayDate} · ${rankedRooms.length}个直播间`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <div className="flex rounded-md bg-gray-800 p-0.5">
                  <button
                    onClick={() => setRankTimeView("month")}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      rankTimeView === "month" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    分月
                  </button>
                  <button
                    onClick={() => setRankTimeView("day")}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      rankTimeView === "day" ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    昨日
                  </button>
                </div>
                <div className="flex gap-1">
                  {METRIC_OPTIONS.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setRankMetric(m.key)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        rankMetric === m.key ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500">
                    <th className="pb-2 text-left font-medium">排名</th>
                    <th className="pb-2 text-left font-medium">直播间</th>
                    <th className="pb-2 text-right font-medium">消耗</th>
                    <th className="pb-2 text-right font-medium">保费</th>
                    <th className="pb-2 text-right font-medium">保单数</th>
                    <th className="pb-2 text-right font-medium">时长(h)</th>
                    <th className="pb-2 text-right font-medium">ROI</th>
                    <th className="pb-2 text-right font-medium">时耗</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRooms.map((r, i) => (
                    <tr key={r.room} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                          i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-gray-400/20 text-gray-300" : i === 2 ? "bg-orange-500/20 text-orange-400" : "text-gray-500"
                        }`}>{i + 1}</span>
                      </td>
                      <td className="py-2 font-medium text-gray-200">{r.room}</td>
                      <td className="py-2 text-right text-cyan-400">{Math.round(r.totalConsume).toLocaleString('zh-CN')}</td>
                      <td className="py-2 text-right text-emerald-400">{Math.round(r.totalPremium).toLocaleString('zh-CN')}</td>
                      <td className="py-2 text-right text-blue-400">{r.totalPolicies}</td>
                      <td className="py-2 text-right text-purple-400">{(r.totalDuration / 60).toFixed(2)}</td>
                      <td className="py-2 text-right text-amber-400">{r.avgRoi.toFixed(2)}</td>
                      <td className="py-2 text-right text-pink-400">{r.avgTimeCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 直播间占比分布 */}
          <RoomBubbleChart data={filteredRecords} currentMonth={currentMonth} latestDate={yesterdayDate} />
        </>
      ) : (
        // 分直播间视图
        <>
          {/* 直播间选择器 */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-sm text-gray-400">选择直播间：</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            >
              {roomList.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {selectedRoom && (() => {
            const roomRecords = recordsByRoom.find(([room]) => room === selectedRoom)?.[1] || [];
            return (
              <RoomSection
                room={selectedRoom}
                records={roomRecords}
                currentMonth={currentMonth}
                dataUpdateDate={latestDate}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
