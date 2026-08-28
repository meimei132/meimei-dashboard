"use client";

import { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { mockData as records, ROOM_LIST as ROOMS } from "@/lib/mock-data";
import { getDailyTrend, getLatestDate, filterUpToYesterday, isDateInMonth, aggregateRecords, normalizeDateForCompare } from "@/lib/data-utils";
import type { SessionRecord } from "@/lib/types";

export default function StreamerPage() {
  const [selectedRoom, setSelectedRoom] = useState<string>(ROOMS[0] || "");
  const [selectedStreamers, setSelectedStreamers] = useState<string[]>([]);
  const [metric, setMetric] = useState<string>("roi");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const latestDate = useMemo(() => getLatestDate(records), [records]);

  // 直接使用所有数据（不过滤）
  const filteredRecords = records;

  // 设置默认日期范围（最近30天）
  const defaultDateRange = useMemo(() => {
    const allDates = [...new Set(filteredRecords.map(r => r.date))].sort((a, b) => 
      normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b))
    );
    const latestIdx = allDates.length - 1;
    const startIdx = Math.max(0, latestIdx - 29);
    // 转换为 YYYY-MM-DD 格式以适配 date input
    const toIsoDate = (d: string) => normalizeDateForCompare(d);
    return {
      start: toIsoDate(allDates[startIdx]),
      end: toIsoDate(allDates[latestIdx]),
    };
  }, [filteredRecords]);

  // 初始化日期
  const [initialized, setInitialized] = useState(false);
  if (!initialized && defaultDateRange.start && defaultDateRange.end) {
    setStartDate(defaultDateRange.start);
    setEndDate(defaultDateRange.end);
    setInitialized(true);
  }

  // 日期范围内的数据
  const dateRangeData = useMemo(() => {
    if (!startDate || !endDate) return filteredRecords;
    const startNorm = normalizeDateForCompare(startDate);
    const endNorm = normalizeDateForCompare(endDate);
    return filteredRecords.filter(r => {
      const rNorm = normalizeDateForCompare(r.date);
      return rNorm >= startNorm && rNorm <= endNorm;
    });
  }, [filteredRecords, startDate, endDate]);

  // 获取当前直播间、当前日期范围内有数据的主播列表
  const streamersInRoom = useMemo(() => {
    if (!selectedRoom) return [];
    return [...new Set(dateRangeData.filter(r => r.room === selectedRoom).map(r => r.streamer))].sort();
  }, [selectedRoom, dateRangeData]);

  // 获取选中主播的趋势数据
  const streamerTrends = useMemo(() => {
    if (selectedStreamers.length === 0 || !selectedRoom) return [];

    return selectedStreamers.map(streamer => {
      const streamerData = dateRangeData.filter(r => r.room === selectedRoom && r.streamer === streamer);
      const trend = getDailyTrend(streamerData);
      
      // 提取指定指标的数据
      const metricData = trend.map(t => ({
        date: t.date,
        value: metric === 'roi' ? t.roi : metric === 'consume' ? t.consume : metric === 'premium' ? t.premium : t.timeCost,
      }));

      // 计算汇总统计
      const stats = aggregateRecords(streamerData);

      return {
        streamer,
        data: metricData,
        stats,
      };
    });
  }, [selectedStreamers, selectedRoom, dateRangeData, metric]);

  // 切换主播选择
  const toggleStreamer = (streamer: string) => {
    setSelectedStreamers(prev => 
      prev.includes(streamer) 
        ? prev.filter(s => s !== streamer)
        : [...prev, streamer]
    );
  };

  // 全选/取消全选
  const toggleAll = () => {
    if (selectedStreamers.length === streamersInRoom.length) {
      setSelectedStreamers([]);
    } else {
      setSelectedStreamers(streamersInRoom);
    }
  };

  const METRIC_OPTIONS = [
    { key: "roi", label: "ROI", color: "#fbbf24" },
    { key: "consume", label: "消耗", color: "#22d3ee" },
    { key: "premium", label: "保费", color: "#10b981" },
    { key: "timeCost", label: "时耗", color: "#f472b6" },
  ];

  // 每个主播不同的颜色
  const STREAMER_COLORS = [
    "#22d3ee", "#f472b6", "#fbbf24", "#10b981", "#a78bfa",
    "#fb923c", "#38bdf8", "#f87171", "#34d399", "#c084fc",
    "#facc15", "#2dd4bf", "#818cf8", "#e879f9", "#fb7185",
    "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4",
    "#ec4899", "#10b981", "#6366f1", "#ef4444", "#84cc16",
  ];

  return (
    <div className="space-y-4">
      {/* Data Update Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          数据更新时间：{latestDate}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="space-y-3">
          {/* Room Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-400">直播间：</label>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setSelectedStreamers([]);
              }}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            >
              {ROOMS.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-gray-400">日期范围：</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={() => {
                setStartDate(defaultDateRange.start);
                setEndDate(defaultDateRange.end);
              }}
              className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              最近30天
            </button>
          </div>

          {/* Metric Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-400">指标：</label>
            {METRIC_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metric === m.key ? "bg-cyan-500/20 text-cyan-400" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Streamer Selector */}
          <div className="border-t border-gray-800 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs text-gray-400">选择主播（可多选对比）：</label>
              <button
                onClick={toggleAll}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                {selectedStreamers.length === streamersInRoom.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {streamersInRoom.map((streamer, idx) => {
                const color = STREAMER_COLORS[idx % STREAMER_COLORS.length];
                const isSelected = selectedStreamers.includes(streamer);
                return (
                  <button
                    key={streamer}
                    onClick={() => toggleStreamer(streamer)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border border-cyan-500/50 bg-cyan-500/20 text-cyan-400"
                        : "border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {streamer}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {streamerTrends.length > 0 ? (
        <div className="space-y-4">
          {/* Trend Chart */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-200">
              {METRIC_OPTIONS.find(m => m.key === metric)?.label}趋势对比
            </h3>
            <ReactECharts
              option={{
                tooltip: {
                  trigger: 'axis',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  textStyle: { color: '#e2e8f0', fontSize: 12 },
                },
                legend: {
                  data: streamerTrends.map(s => s.streamer),
                  textStyle: { color: '#94a3b8', fontSize: 11 },
                  bottom: 0,
                  icon: 'circle',
                  itemWidth: 10,
                  itemHeight: 10,
                },
                grid: { left: 50, right: 20, top: 20, bottom: 40 },
                xAxis: {
                  type: 'category',
                  data: streamerTrends[0].data.map(d => d.date),
                  axisLine: { lineStyle: { color: '#334155' } },
                  axisLabel: { color: '#64748b', fontSize: 10, rotate: streamerTrends[0].data.length > 15 ? 45 : 0 },
                },
                yAxis: {
                  type: 'value',
                  axisLine: { lineStyle: { color: '#334155' } },
                  axisLabel: { color: '#64748b', fontSize: 10 },
                  splitLine: { lineStyle: { color: '#1e293b' } },
                },
                series: streamerTrends.map((s, i) => ({
                  name: s.streamer,
                  type: 'line',
                  smooth: true,
                  symbol: 'circle',
                  symbolSize: 4,
                  data: s.data.map(d => d.value),
                  lineStyle: { width: 2, color: STREAMER_COLORS[i % STREAMER_COLORS.length] },
                  itemStyle: { color: STREAMER_COLORS[i % STREAMER_COLORS.length] },
                })),
              }}
              style={{ height: 320 }}
              opts={{ renderer: 'svg' }}
            />
          </div>

          {/* Stats Comparison Table */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-200">主播数据对比</h3>
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
                  {streamerTrends.map((s, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 font-medium text-gray-200">{s.streamer}</td>
                      <td className="py-2 text-right text-cyan-400">{Math.round(s.stats.totalConsume).toLocaleString('zh-CN')}</td>
                      <td className="py-2 text-right text-emerald-400">{Math.round(s.stats.totalPremium).toLocaleString('zh-CN')}</td>
                      <td className="py-2 text-right text-blue-400">{s.stats.totalPolicies}</td>
                      <td className="py-2 text-right text-purple-400">{(s.stats.totalDuration / 60).toFixed(2)}</td>
                      <td className="py-2 text-right text-amber-400">{s.stats.avgRoi.toFixed(2)}</td>
                      <td className="py-2 text-right text-pink-400">{s.stats.avgTimeCost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-8 text-center">
          <p className="text-sm text-gray-500">请选择主播开始对比分析</p>
        </div>
      )}
    </div>
  );
}
