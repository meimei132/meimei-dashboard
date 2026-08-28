"use client";

import { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { mockData as records, ROOM_LIST as ROOMS } from "@/lib/mock-data";
import { aggregateRooms, aggregateRecords, detectAlerts, getAlerts, getDailyTrend, formatNumber, formatCurrency, formatDuration, getLatestDate, getMonthKey, isDateInMonth, filterUpToYesterday, getYesterdayDate, normalizeDateForCompare } from "@/lib/data-utils";
import type { AlertItem } from "@/lib/types";
import AlertBanner from "@/components/AlertBanner";

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
      <p className="text-xs text-gray-400">{title}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TrendChart({ data, title, color }: { data: { date: string; value: number }[]; title: string; color: string }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
        <h4 className="mb-2 text-xs font-medium text-gray-400">{title}</h4>
        <div className="flex h-20 items-center justify-center text-xs text-gray-500">
          暂无数据
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
      <h4 className="mb-2 text-xs font-medium text-gray-400">{title}</h4>
      <ReactECharts
        option={{
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#334155',
            textStyle: { color: '#e2e8f0', fontSize: 11 },
          },
          grid: { left: 40, right: 10, top: 5, bottom: 15 },
          xAxis: {
            type: 'category',
            data: data.map(d => d.date),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 8, rotate: data.length > 15 ? 45 : 0 },
          },
          yAxis: {
            type: 'value',
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#64748b', fontSize: 9 },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          series: [{
            type: 'line',
            data: data.map(d => d.value),
            smooth: true,
            symbol: 'circle',
            symbolSize: 3,
            lineStyle: { width: 1.5, color },
            itemStyle: { color },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: color + '30' },
                  { offset: 1, color: color + '05' },
                ],
              },
            },
          }],
        }}
        style={{ height: 120 }}
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}

export default function RoomPage() {
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [compareMode, setCompareMode] = useState(false);
  const [compareStreamers, setCompareStreamers] = useState<string[]>([]);
  const [streamerSortBy, setStreamerSortBy] = useState<"consume" | "premium" | "roi" | "timeCost">("consume");
  const [yesterdaySortBy, setYesterdaySortBy] = useState<"consume" | "premium" | "roi" | "timeCost">("consume");

  // 使用当前系统月份
  const currentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  // 数据中最新的日期（用于显示更新时间）
  const latestDate = useMemo(() => getLatestDate(records), [records]);

  // 直接使用所有数据（不过滤）
  const filteredRecords = useMemo(() => {
    let filtered = records.filter(r => isDateInMonth(r.date, currentMonth));
    if (selectedRoom !== "all") filtered = filtered.filter(r => r.room === selectedRoom);
    return filtered;
  }, [selectedRoom, currentMonth]);

  // Streamer stats for selected room
  const streamerStats = useMemo(() => {
    const map = new Map<string, typeof filteredRecords>();
    for (const r of filteredRecords) {
      if (!r.streamer || r.streamer.trim() === '') continue; // 过滤空主播
      const arr = map.get(r.streamer) || [];
      arr.push(r);
      map.set(r.streamer, arr);
    }
    const stats = Array.from(map.entries())
      .map(([streamer, recs]) => ({
        streamer,
        room: recs[0].room,
        ...aggregateRecords(recs),
        recordCount: recs.length,
      }));
    
    // Sort by selected metric
    switch (streamerSortBy) {
      case "premium":
        return stats.sort((a, b) => b.totalPremium - a.totalPremium);
      case "roi":
        return stats.sort((a, b) => b.avgRoi - a.avgRoi);
      case "timeCost":
        return stats.sort((a, b) => b.avgTimeCost - a.avgTimeCost);
      default:
        return stats.sort((a, b) => b.totalConsume - a.totalConsume);
    }
  }, [filteredRecords, streamerSortBy]);

  // Yesterday's records (使用最新日期的数据)
  const yesterdayRecords = useMemo(() => {
    const yd = getLatestDate(records);
    let recs = records.filter(r => r.date === yd);
    if (selectedRoom !== "all") recs = recs.filter(r => r.room === selectedRoom);
    return recs;
  }, [selectedRoom]);

  // Yesterday's streamer stats
  const yesterdayStreamerStats = useMemo(() => {
    const map = new Map<string, typeof yesterdayRecords>();
    for (const r of yesterdayRecords) {
      if (!r.streamer || r.streamer.trim() === '') continue;
      const arr = map.get(r.streamer) || [];
      arr.push(r);
      map.set(r.streamer, arr);
    }
    const stats = Array.from(map.entries())
      .map(([streamer, recs]) => ({
        streamer,
        room: recs[0].room,
        ...aggregateRecords(recs),
        recordCount: recs.length,
      }));
    
    switch (yesterdaySortBy) {
      case "premium":
        return stats.sort((a, b) => b.totalPremium - a.totalPremium);
      case "roi":
        return stats.sort((a, b) => b.avgRoi - a.avgRoi);
      case "timeCost":
        return stats.sort((a, b) => b.avgTimeCost - a.avgTimeCost);
      default:
        return stats.sort((a, b) => b.totalConsume - a.totalConsume);
    }
  }, [yesterdayRecords, yesterdaySortBy]);

  // Daily breakdown
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, typeof filteredRecords>();
    for (const r of filteredRecords) {
      const arr = map.get(r.date) || [];
      arr.push(r);
      map.set(r.date, arr);
    }
    return Array.from(map.entries())
      .map(([date, recs]) => ({ date, ...aggregateRecords(recs) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // Alerts for streamers (exclude today)
  const streamerAlerts = useMemo(() => {
    return getAlerts(filteredRecords, "streamer");
  }, [filteredRecords]);

  // Trends
  const roiTrend = useMemo(() => getDailyTrend(filteredRecords, "roi") as unknown as { date: string; value: number }[], [filteredRecords]);
  const timeCostTrend = useMemo(() => getDailyTrend(filteredRecords, "timeCost") as unknown as { date: string; value: number }[], [filteredRecords]);

  // Room-level monthly totals
  const roomTotals = useMemo(() => {
    const recs = filteredRecords.filter(r => isDateInMonth(r.date, currentMonth));
    const map = new Map<string, typeof recs>();
    for (const r of recs) {
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.entries())
      .map(([room, recs]) => ({ room, ...aggregateRecords(recs) }))
      .sort((a, b) => b.totalConsume - a.totalConsume);
  }, [currentMonth, filteredRecords]);

  // Compare mode
  const allStreamers = useMemo(() => {
    const set = new Set(filteredRecords.map(r => r.streamer));
    return Array.from(set).sort();
  }, [filteredRecords]);

  const compareData = useMemo(() => {
    if (!compareMode || compareStreamers.length === 0) return [];
    return compareStreamers.map(name => {
      const recs = filteredRecords.filter(r => r.streamer === name);
      return { streamer: name, ...aggregateRecords(recs), recordCount: recs.length };
    });
  }, [compareMode, compareStreamers, filteredRecords]);

  const roomAgg = useMemo(() => aggregateRecords(filteredRecords), [filteredRecords]);

  return (
    <div className="space-y-4">
      {/* Data Update Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          数据更新时间：{latestDate}
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
          📊 数据仅为 8 月
        </div>
      </div>

      {/* Room selector + Compare mode */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">选择直播间：</span>
          <button
            onClick={() => setSelectedRoom("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${selectedRoom === "all" ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
          >
            全部
          </button>
          {ROOMS.map(room => (
            <button
              key={room}
              onClick={() => setSelectedRoom(room)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${selectedRoom === room ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
            >
              {room}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCompareMode(!compareMode)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${compareMode ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
        >
          {compareMode ? "退出对比" : "主播对比"}
        </button>
      </div>

      {/* Alerts */}
      <AlertBanner alerts={streamerAlerts} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <StatCard title="总消耗" value={Math.round(roomAgg.totalConsume).toLocaleString('zh-CN')} color="text-cyan-400" />
        <StatCard title="总保费" value={Math.round(roomAgg.totalPremium).toLocaleString('zh-CN')} color="text-emerald-400" />
        <StatCard title="保单数" value={roomAgg.totalPolicies.toLocaleString()} color="text-blue-400" />
        <StatCard title="总时长" value={`${Math.round(roomAgg.totalDuration / 60)}h`} color="text-purple-400" />
        <StatCard title="平均ROI" value={roomAgg.avgRoi.toFixed(2)} color="text-amber-400" />
        <StatCard title="平均时耗" value={roomAgg.avgTimeCost.toFixed(2)} color="text-pink-400" />
      </div>

      {/* Trend charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart data={roiTrend} title="ROI 趋势" color="#fbbf24" />
        <TrendChart data={timeCostTrend} title="时耗趋势" color="#f472b6" />
      </div>

      {/* Streamer ranking table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-200">
            主播数据 {selectedRoom !== "all" ? `· ${selectedRoom}` : "· 全部直播间"}
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">排序：</span>
            {(["consume", "premium", "roi", "timeCost"] as const).map(key => (
              <button
                key={key}
                onClick={() => setStreamerSortBy(key)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${streamerSortBy === key ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
              >
                {key === "consume" ? "消耗" : key === "premium" ? "保费" : key === "roi" ? "ROI" : "时耗"}
              </button>
            ))}
          </div>
        </div>

        {compareMode && (
          <div className="mb-3 flex flex-wrap gap-1">
            {allStreamers.map(s => (
              <button
                key={s}
                onClick={() => setCompareStreamers(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${compareStreamers.includes(s) ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-500 hover:text-gray-300"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {compareMode && compareData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
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
                {compareData.map((s, i) => (
                  <tr key={s.streamer} className="border-b border-gray-800/50">
                    <td className="py-2 font-medium text-gray-200">{s.streamer}</td>
                    <td className="py-2 text-right text-cyan-400">{Math.round(s.totalConsume).toLocaleString('zh-CN')}</td>
                    <td className="py-2 text-right text-emerald-400">{Math.round(s.totalPremium).toLocaleString('zh-CN')}</td>
                    <td className="py-2 text-right text-blue-400">{s.totalPolicies}</td>
                    <td className="py-2 text-right text-purple-400">{(s.totalDuration / 60).toFixed(1)}</td>
                    <td className="py-2 text-right text-amber-400">{s.avgRoi.toFixed(2)}</td>
                    <td className="py-2 text-right text-pink-400">{s.avgTimeCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500">
                  <th className="pb-2 text-left font-medium">排名</th>
                  <th className="pb-2 text-left font-medium">主播</th>
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
                {streamerStats.map((s, i) => (
                  <tr key={s.streamer} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 font-medium text-gray-200">{s.streamer}</td>
                    <td className="py-2 text-xs text-gray-400">{s.room}</td>
                    <td className="py-2 text-right text-cyan-400">{Math.round(s.totalConsume).toLocaleString('zh-CN')}</td>
                    <td className="py-2 text-right text-emerald-400">{Math.round(s.totalPremium).toLocaleString('zh-CN')}</td>
                    <td className="py-2 text-right text-blue-400">{s.totalPolicies}</td>
                    <td className="py-2 text-right text-purple-400">{(s.totalDuration / 60).toFixed(1)}</td>
                    <td className="py-2 text-right text-amber-400">{s.avgRoi.toFixed(2)}</td>
                    <td className="py-2 text-right text-pink-400">{s.avgTimeCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Yesterday's data */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-200">昨日数据</h3>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">排序：</span>
            {(["consume", "premium", "roi", "timeCost"] as const).map(key => (
              <button
                key={key}
                onClick={() => setYesterdaySortBy(key)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${yesterdaySortBy === key ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"}`}
              >
                {key === "consume" ? "消耗" : key === "premium" ? "保费" : key === "roi" ? "ROI" : "时耗"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="pb-2 text-left font-medium">排名</th>
                <th className="pb-2 text-left font-medium">主播</th>
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
              {yesterdayStreamerStats.map((s, i) => (
                <tr key={s.streamer} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${i < 3 ? "bg-amber-500/20 text-amber-400" : "text-gray-500"}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2 font-medium text-gray-200">{s.streamer}</td>
                  <td className="py-2 text-xs text-gray-400">{s.room}</td>
                  <td className="py-2 text-right text-cyan-400">{Math.round(s.totalConsume).toLocaleString('zh-CN')}</td>
                  <td className="py-2 text-right text-emerald-400">{Math.round(s.totalPremium).toLocaleString('zh-CN')}</td>
                  <td className="py-2 text-right text-blue-400">{s.totalPolicies}</td>
                  <td className="py-2 text-right text-purple-400">{(s.totalDuration / 60).toFixed(1)}</td>
                  <td className="py-2 text-right text-amber-400">{s.avgRoi.toFixed(2)}</td>
                  <td className="py-2 text-right text-pink-400">{s.avgTimeCost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
