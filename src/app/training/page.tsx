'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SESSION_RECORDS } from '@/lib/mock-data';
import {
  getLatestDate,
  getYesterdayDate,
  formatCurrency,
  formatNumber,
  formatDuration,
  aggregateRooms,
  aggregateStreamers,
  detectAlerts,
} from '@/lib/data-utils';
import type { RoomSummary, StreamerSummary, AlertItem } from '@/lib/types';
import TrendChart from '@/components/TrendChart';

// 类型兼容处理
const records = SESSION_RECORDS as any[];

export default function TrainingDashboard() {
  const [latestDate, setLatestDate] = useState('');
  const [yesterday, setYesterday] = useState('');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [roomAgg, setRoomAgg] = useState<RoomSummary[]>([]);
  const [streamerAgg, setStreamerAgg] = useState<StreamerSummary[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('all');

  useEffect(() => {
    const latest = getLatestDate(records);
    setLatestDate(latest);
    setYesterday(getYesterdayDate(records));

    // 检测预警
    const detected = detectAlerts(records);
    setAlerts(detected);

    // 聚合数据
    setRoomAgg(aggregateRooms(records));
    setStreamerAgg(aggregateStreamers(records));
  }, []);

  // 筛选数据
  const filteredRecords = selectedRoom === 'all'
    ? records
    : records.filter(r => r.roomName === selectedRoom);

  const filteredStreamers = selectedRoom === 'all'
    ? streamerAgg
    : streamerAgg.filter(s => s.room === selectedRoom);

  // 计算汇总指标
  const totalConsume = filteredRecords.reduce((sum, r) => sum + r.consume, 0);
  const totalPremium = filteredRecords.reduce((sum, r) => sum + r.premium, 0);
  const totalPolicies = filteredRecords.reduce((sum, r) => sum + r.policies, 0);
  const totalDuration = filteredRecords.reduce((sum, r) => sum + r.duration, 0);
  const avgROI = totalConsume > 0 ? totalPremium / totalConsume : 0;
  const avgTimeCost = totalPolicies > 0 ? totalConsume / totalPolicies : 0;

  // 主播排名（按时长）
  const topStreamersByDuration = [...filteredStreamers]
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 10);

  // 主播排名（按保费）
  const topStreamersByPremium = [...filteredStreamers]
    .sort((a, b) => b.totalPremium - a.totalPremium)
    .slice(0, 10);

  // 直播间数据
  const roomData = roomAgg.map(r => ({
    name: r.room,
    consume: r.totalConsume,
    premium: r.totalPremium,
    roi: r.totalConsume > 0 ? r.totalPremium / r.totalConsume : 0,
    duration: r.totalDuration,
    streamers: r.streamerCount,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] p-6">
      {/* 顶部导航 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#00d4ff]">培训数据大屏</h1>
          <p className="text-sm text-[#94a3b8] mt-1">数据更新至 {latestDate}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-[#14142380] border border-[#00d4ff30] rounded hover:border-[#00d4ff] transition-colors">
            返回总览
          </Link>
          <Link href="/showcase" className="px-4 py-2 bg-[#00d4ff20] border border-[#00d4ff] rounded hover:bg-[#00d4ff30] transition-colors">
            展示大屏
          </Link>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="mb-6 flex gap-3">
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="px-4 py-2 bg-[#14142380] border border-[#00d4ff30] rounded text-[#e2e8f0] focus:outline-none focus:border-[#00d4ff]"
        >
          <option value="all">全部直播间</option>
          {roomAgg.map(r => (
            <option key={r.room} value={r.room}>{r.room}</option>
          ))}
        </select>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <MetricCard label="总消耗" value={formatCurrency(totalConsume)} color="#00d4ff" />
        <MetricCard label="总保费" value={formatCurrency(totalPremium)} color="#10b981" />
        <MetricCard label="总保单" value={formatNumber(totalPolicies)} color="#10b981" />
        <MetricCard label="总时长" value={formatDuration(totalDuration)} color="#00d4ff" />
        <MetricCard label="ROI" value={avgROI.toFixed(2)} color={avgROI >= 1 ? "#10b981" : "#f59e0b"} />
        <MetricCard label="时耗" value={formatCurrency(avgTimeCost)} color={avgTimeCost <= 1000 ? "#10b981" : "#f59e0b"} />
      </div>

      {/* 预警面板 */}
      {alerts.length > 0 && (
        <div className="mb-6 bg-[#14142380] border border-[#ef444430] rounded-lg p-4">
          <h3 className="text-lg font-bold text-[#ef4444] mb-3">⚠️ 预警信息</h3>
          <div className="grid grid-cols-2 gap-3">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={alert.direction === 'down' ? 'text-[#ef4444]' : 'text-[#10b981]'}>
                  {alert.direction === 'down' ? '🔴' : '🟢'}
                </span>
                <div>
                  <span className="text-[#e2e8f0]">{alert.name}</span>
                  <span className="text-[#94a3b8] ml-2">{alert.metricLabel} {alert.direction === 'down' ? '下降' : '上升'} {alert.days} 天</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 直播间对比 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-4">
          <h3 className="text-lg font-bold text-[#00d4ff] mb-4">直播间对比</h3>
          <div className="space-y-3">
            {roomData.map((room, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#0a0a0f50] rounded">
                <div className="flex-1">
                  <div className="font-medium">{room.name}</div>
                  <div className="text-xs text-[#94a3b8] mt-1">
                    {room.streamers} 位主播 · {formatDuration(room.duration)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#00d4ff] font-bold">{formatCurrency(room.premium)}</div>
                  <div className="text-xs text-[#94a3b8]">ROI: {room.roi.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 主播排名（时长） */}
        <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-4">
          <h3 className="text-lg font-bold text-[#00d4ff] mb-4">主播排名（直播时长）</h3>
          <div className="space-y-2">
            {topStreamersByDuration.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-[#0a0a0f50] rounded">
                <span className="text-[#94a3b8] w-6 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.streamer}</div>
                  <div className="text-xs text-[#94a3b8]">{s.room}</div>
                </div>
                <div className="text-[#00d4ff] font-mono text-sm">
                  {formatDuration(s.totalDuration)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 主播排名（保费） */}
      <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-[#00d4ff] mb-4">主播排名（保费收入）</h3>
        <div className="grid grid-cols-5 gap-3">
          {topStreamersByPremium.map((s, i) => (
            <div key={i} className="p-3 bg-[#0a0a0f50] rounded border border-[#00d4ff10]">
              <div className="text-xs text-[#94a3b8] mb-1">#{i + 1}</div>
              <div className="font-medium truncate">{s.streamer}</div>
              <div className="text-xs text-[#94a3b8] mb-2">{s.room}</div>
              <div className="text-[#10b981] font-bold">{formatCurrency(s.totalPremium)}</div>
              <div className="text-xs text-[#94a3b8] mt-1">
                ROI: {s.totalConsume > 0 ? (s.totalPremium / s.totalConsume).toFixed(2) : '0.00'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 趋势图 */}
      <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-4">
        <h3 className="text-lg font-bold text-[#00d4ff] mb-4">数据趋势</h3>
        <TrendChart
          data={filteredRecords.map(r => ({ date: r.date, value: r.premium }))}
          title="保费趋势"
          color="#10b981"
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-4 hover:border-[#00d4ff50] transition-colors">
      <div className="text-xs text-[#94a3b8] mb-2">{label}</div>
      <div className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
