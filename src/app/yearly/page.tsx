"use client";

import { useState, useMemo } from "react";
import { mockData as records, ROOM_LIST as ROOMS } from "@/lib/mock-data";
import { aggregateRecords, getLatestDate, normalizeDateForCompare } from "@/lib/data-utils";
import type { SessionRecord } from "@/lib/types";

export default function YearlyPage() {
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("2026-01-01");
  const [endDate, setEndDate] = useState<string>("2026-12-31");

  const latestDate = useMemo(() => getLatestDate(records), [records]);

  // Normalize date for comparison (handles both "2026.8.1" and "2026-01-01" formats)
  const normalizeDate = (d: string): string => {
    return d.replace(/\./g, '-').replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  };

  // Filter records by date range and room
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const normalizedDate = normalizeDate(r.date);
      const inDateRange = normalizedDate >= startDate && normalizedDate <= endDate;
      const inRoom = selectedRoom === "all" || r.room === selectedRoom;
      return inDateRange && inRoom;
    });
  }, [startDate, endDate, selectedRoom]);

  // Aggregate by room
  const roomStats = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const r of filteredRecords) {
      const arr = map.get(r.room) || [];
      arr.push(r);
      map.set(r.room, arr);
    }
    return Array.from(map.entries())
      .map(([room, recs]) => ({
        room,
        ...aggregateRecords(recs),
        hours: recs.length, // 每条记录代表1小时
      }))
      .sort((a, b) => b.totalConsume - a.totalConsume);
  }, [filteredRecords]);

  // Aggregate by streamer
  const streamerStats = useMemo(() => {
    const map = new Map<string, SessionRecord[]>();
    for (const r of filteredRecords) {
      const arr = map.get(r.streamer) || [];
      arr.push(r);
      map.set(r.streamer, arr);
    }
    return Array.from(map.entries())
      .map(([streamer, recs]) => ({
        streamer,
        room: recs[0].room,
        ...aggregateRecords(recs),
        hours: recs.length, // 每条记录代表1小时
      }))
      .sort((a, b) => b.totalConsume - a.totalConsume);
  }, [filteredRecords]);

  // Overall stats
  const overallStats = useMemo(() => {
    return aggregateRecords(filteredRecords);
  }, [filteredRecords]);

  // Unique dates in range
  const uniqueDates = useMemo(() => {
    const dates = new Set(filteredRecords.map(r => r.date));
    return Array.from(dates).sort((a, b) => 
      normalizeDateForCompare(a).localeCompare(normalizeDateForCompare(b))
    );
  }, [filteredRecords]);

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
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">开始日期：</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min="2026-01-01"
              max="2026-12-31"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">结束日期：</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min="2026-01-01"
              max="2026-12-31"
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Room Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">直播间：</label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">全部直播间</option>
              {ROOMS.map(room => (
                <option key={room} value={room}>{room}</option>
              ))}
            </select>
          </div>

          {/* Quick Select */}
          <div className="flex gap-1">
            <button
              onClick={() => { setStartDate("2026-01-01"); setEndDate("2026-03-31"); }}
              className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              Q1
            </button>
            <button
              onClick={() => { setStartDate("2026-04-01"); setEndDate("2026-06-30"); }}
              className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              Q2
            </button>
            <button
              onClick={() => { setStartDate("2026-07-01"); setEndDate("2026-09-30"); }}
              className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              Q3
            </button>
            <button
              onClick={() => { setStartDate("2026-10-01"); setEndDate("2026-12-31"); }}
              className="rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
            >
              Q4
            </button>
            <button
              onClick={() => { setStartDate("2026-01-01"); setEndDate("2026-12-31"); }}
              className="rounded-md bg-cyan-500/20 px-2 py-1 text-xs text-cyan-400"
            >
              全年
            </button>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">总消耗</p>
          <p className="mt-1 text-xl font-bold text-cyan-400">{Math.round(overallStats.totalConsume).toLocaleString('zh-CN')}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">总保费</p>
          <p className="mt-1 text-xl font-bold text-emerald-400">{Math.round(overallStats.totalPremium).toLocaleString('zh-CN')}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">总保单数</p>
          <p className="mt-1 text-xl font-bold text-blue-400">{overallStats.totalPolicies.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">总时长</p>
          <p className="mt-1 text-xl font-bold text-purple-400">{Math.round(overallStats.totalDuration / 60)}h</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">平均ROI</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{overallStats.avgRoi.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-3">
          <p className="text-xs text-gray-400">平均时耗</p>
          <p className="mt-1 text-xl font-bold text-pink-400">{overallStats.avgTimeCost.toFixed(2)}</p>
        </div>
      </div>

      {/* Room Stats Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-200">直播间数据明细</h3>
          <p className="text-xs text-gray-500">
            {startDate} ~ {endDate} · {roomStats.length}个直播间 · {uniqueDates.length}天有数据
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="pb-2 text-left font-medium">直播间</th>
                <th className="pb-2 text-right font-medium">小时</th>
                <th className="pb-2 text-right font-medium">消耗</th>
                <th className="pb-2 text-right font-medium">保费</th>
                <th className="pb-2 text-right font-medium">保单数</th>
                <th className="pb-2 text-right font-medium">时长(h)</th>
                <th className="pb-2 text-right font-medium">ROI</th>
                <th className="pb-2 text-right font-medium">时耗</th>
              </tr>
            </thead>
            <tbody>
              {roomStats.map((r) => (
                <tr key={r.room} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 font-medium text-gray-200">{r.room}</td>
                  <td className="py-2 text-right text-gray-400">{r.hours}</td>
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

      {/* Streamer Stats Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-200">主播数据明细</h3>
          <p className="text-xs text-gray-500">
            {startDate} ~ {endDate} · {streamerStats.length}位主播
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500">
                <th className="pb-2 text-left font-medium">排名</th>
                <th className="pb-2 text-left font-medium">主播</th>
                <th className="pb-2 text-left font-medium">直播间</th>
                <th className="pb-2 text-right font-medium">小时</th>
                <th className="pb-2 text-right font-medium">消耗</th>
                <th className="pb-2 text-right font-medium">保费</th>
                <th className="pb-2 text-right font-medium">保单数</th>
                <th className="pb-2 text-right font-medium">时长(h)</th>
                <th className="pb-2 text-right font-medium">ROI</th>
                <th className="pb-2 text-right font-medium">时耗</th>
              </tr>
            </thead>
            <tbody>
              {streamerStats.map((r, idx) => (
                <tr key={r.streamer} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                      idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2 font-medium text-gray-200">{r.streamer}</td>
                  <td className="py-2 text-gray-400">{r.room}</td>
                  <td className="py-2 text-right text-gray-400">{r.hours}</td>
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
