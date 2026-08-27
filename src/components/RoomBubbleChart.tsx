"use client";

import { useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { SessionRecord } from "@/lib/types";
import { aggregateRecords, isDateInMonth } from "@/lib/data-utils";

const METRIC_OPTIONS = [
  { key: "consume", label: "消耗占比", color: "#22d3ee" },
  { key: "duration", label: "时长占比", color: "#a78bfa" },
  { key: "premium", label: "保费占比", color: "#10b981" },
] as const;

const TIME_OPTIONS = [
  { key: "month", label: "分月" },
  { key: "day", label: "昨日" },
] as const;

export default function RoomBubbleChart({ data, currentMonth, latestDate }: {
  data: SessionRecord[];
  currentMonth: string;
  latestDate: string;
}) {
  const [metric, setMetric] = useState<string>("consume");
  const [timeView, setTimeView] = useState<string>("month");

  const chartData = useMemo(() => {
    const filtered = timeView === "month"
      ? data.filter(r => isDateInMonth(r.date, currentMonth))
      : data.filter(r => r.date === latestDate);

    const roomMap = new Map<string, SessionRecord[]>();
    for (const r of filtered) {
      const arr = roomMap.get(r.room) || [];
      arr.push(r);
      roomMap.set(r.room, arr);
    }

    return Array.from(roomMap.entries()).map(([room, recs]) => {
      const agg = aggregateRecords(recs);
      const value = metric === "consume" ? agg.totalConsume
        : metric === "duration" ? agg.totalDuration / 60  // 转换为小时
        : agg.totalPremium;
      return { name: room, value: Math.round(value * 100) / 100 };
    }).sort((a, b) => b.value - a.value);
  }, [data, metric, timeView, currentMonth, latestDate]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  const option = useMemo(() => ({
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(15, 15, 30, 0.9)",
      borderColor: "#334155",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      formatter: (params: { name: string; value: number; percent: number }) => {
        const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : "0";
        return `${params.name}<br/>${params.value.toLocaleString()} (${pct}%)`;
      },
    },
    series: [{
      type: "pie",
      radius: ["35%", "70%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: "#0a0a0f",
        borderWidth: 2,
      },
      label: {
        show: true,
        position: "outside",
        color: "#94a3b8",
        fontSize: 11,
        formatter: (params: { name: string; percent: number }) => {
          return `${params.name}\n${params.percent.toFixed(2)}%`;
        },
      },
      labelLine: {
        lineStyle: { color: "#475569" },
        length: 10,
        length2: 15,
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 20,
          shadowColor: "rgba(0, 212, 255, 0.5)",
        },
        label: {
          fontSize: 13,
          fontWeight: "bold",
          color: "#e2e8f0",
        },
      },
      data: chartData.map((d, i) => ({
        ...d,
        itemStyle: {
          color: [
            "#22d3ee", "#10b981", "#f59e0b", "#ef4444",
            "#a78bfa", "#f472b6", "#3b82f6", "#8b5cf6",
            "#06b6d4", "#14b8a6", "#eab308", "#ec4899",
          ][i % 12],
        },
      })),
    }],
  }), [chartData, total]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-300">直播间占比分布</h4>
        <div className="flex gap-1.5">
          <div className="flex rounded-md bg-gray-800 p-0.5">
            {METRIC_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  metric === m.key ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md bg-gray-800 p-0.5">
            {TIME_OPTIONS.map(t => (
              <button
                key={t.key}
                onClick={() => setTimeView(t.key)}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  timeView === t.key ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="h-[320px]">
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
