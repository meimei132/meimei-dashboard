'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SESSION_RECORDS, ROOM_SUMMARIES, STREAMER_SUMMARIES } from '@/lib/mock-data';
import {
  getLatestDate,
  formatCurrency,
  formatNumber,
  formatDuration,
  aggregateByRoom,
  aggregateByStreamer,
} from '@/lib/data-utils';
import type { SessionRecord, RoomSummary, StreamerSummary } from '@/lib/types';

export default function ShowcaseDashboard() {
  const [latestDate, setLatestDate] = useState('');
  const [roomAgg, setRoomAgg] = useState<RoomSummary[]>([]);
  const [streamerAgg, setStreamerAgg] = useState<StreamerSummary[]>([]);

  useEffect(() => {
    setLatestDate(getLatestDate(SESSION_RECORDS));
    setRoomAgg(aggregateByRoom(SESSION_RECORDS));
    setStreamerAgg(aggregateByStreamer(SESSION_RECORDS));
  }, []);

  // 汇总数据
  const totalConsume = SESSION_RECORDS.reduce((sum, r) => sum + r.consume, 0);
  const totalPremium = SESSION_RECORDS.reduce((sum, r) => sum + r.premium, 0);
  const totalPolicies = SESSION_RECORDS.reduce((sum, r) => sum + r.policies, 0);
  const totalDuration = SESSION_RECORDS.reduce((sum, r) => sum + r.duration, 0);
  const avgROI = totalConsume > 0 ? totalPremium / totalConsume : 0;

  // 直播间数量
  const roomCount = roomAgg.length;

  // 主播数量
  const streamerCount = streamerAgg.length;

  // 直播时间段分布
  const hourDistribution = Array(24).fill(0);
  SESSION_RECORDS.forEach(r => {
    const hour = parseInt(r.timeSlot.split(':')[0]);
    hourDistribution[hour] += r.duration;
  });

  // 找到最活跃的时段
  const peakHours = hourDistribution
    .map((duration, hour) => ({ hour, duration }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 3);

  // 直播间数据
  const roomData = roomAgg.map(r => ({
    name: r.roomName,
    consume: r.totalConsume,
    premium: r.totalPremium,
    roi: r.totalConsume > 0 ? r.totalPremium / r.totalConsume : 0,
    duration: r.totalDuration,
    streamers: r.streamerCount,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e8f0] p-6">
      {/* 顶部 */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#00d4ff]">美魅直播数据中心</h1>
          <p className="text-sm text-[#94a3b8] mt-2">数据更新至 {latestDate}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/" className="px-4 py-2 bg-[#14142380] border border-[#00d4ff30] rounded hover:border-[#00d4ff] transition-colors">
            返回总览
          </Link>
          <Link href="/training" className="px-4 py-2 bg-[#00d4ff20] border border-[#00d4ff] rounded hover:bg-[#00d4ff30] transition-colors">
            培训大屏
          </Link>
        </div>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-5 gap-6 mb-8">
        <ShowcaseCard
          label="直播间"
          value={`${roomCount} 个`}
          icon=""
          color="#00d4ff"
        />
        <ShowcaseCard
          label="主播"
          value={`${streamerCount} 位`}
          icon=""
          color="#00d4ff"
        />
        <ShowcaseCard
          label="总保费"
          value={formatCurrency(totalPremium)}
          icon="💰"
          color="#10b981"
        />
        <ShowcaseCard
          label="总保单"
          value={`${formatNumber(totalPolicies)} 单`}
          icon="📋"
          color="#10b981"
        />
        <ShowcaseCard
          label="ROI"
          value={avgROI.toFixed(2)}
          icon="📈"
          color={avgROI >= 1 ? "#10b981" : "#f59e0b"}
        />
      </div>

      {/* 直播间展示 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {roomData.map((room, i) => (
          <div key={i} className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-6">
            <h3 className="text-xl font-bold text-[#00d4ff] mb-4">{room.name}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[#94a3b8] mb-1">主播数</div>
                <div className="text-2xl font-bold text-[#e2e8f0]">{room.streamers}</div>
              </div>
              <div>
                <div className="text-xs text-[#94a3b8] mb-1">总保费</div>
                <div className="text-2xl font-bold text-[#10b981]">{formatCurrency(room.premium)}</div>
              </div>
              <div>
                <div className="text-xs text-[#94a3b8] mb-1">ROI</div>
                <div className="text-2xl font-bold text-[#00d4ff]">{room.roi.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#00d4ff10]">
              <div className="text-xs text-[#94a3b8]">
                累计直播 {formatDuration(room.duration)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 直播时段分布 */}
      <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-6 mb-8">
        <h3 className="text-xl font-bold text-[#00d4ff] mb-6">直播时段分布</h3>
        <div className="grid grid-cols-24 gap-1 h-32">
          {hourDistribution.map((duration, hour) => {
            const maxDuration = Math.max(...hourDistribution);
            const height = maxDuration > 0 ? (duration / maxDuration) * 100 : 0;
            const isPeak = peakHours.some(p => p.hour === hour);
            return (
              <div key={hour} className="flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-t transition-all ${
                    isPeak ? 'bg-[#00d4ff]' : 'bg-[#00d4ff30]'
                  }`}
                  style={{ height: `${height}%` }}
                />
                <div className="text-xs text-[#94a3b8] mt-2">{hour}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#00d4ff] rounded" />
            <span className="text-[#94a3b8]">高峰时段</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#00d4ff30] rounded" />
            <span className="text-[#94a3b8]">普通时段</span>
          </div>
        </div>
      </div>

      {/* 主播风采 */}
      <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-6">
        <h3 className="text-xl font-bold text-[#00d4ff] mb-6">主播风采</h3>
        <div className="grid grid-cols-6 gap-4">
          {streamerAgg
            .sort((a, b) => b.totalPremium - a.totalPremium)
            .slice(0, 12)
            .map((s, i) => (
              <div key={i} className="text-center p-4 bg-[#0a0a0f50] rounded border border-[#00d4ff10]">
                <div className="text-3xl mb-2">👤</div>
                <div className="font-medium text-sm truncate">{s.streamerName}</div>
                <div className="text-xs text-[#94a3b8] mt-1">{s.roomName}</div>
                <div className="text-[#10b981] font-bold text-sm mt-2">
                  {formatCurrency(s.totalPremium)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function ShowcaseCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-[#14142380] border border-[#00d4ff20] rounded-lg p-6 text-center hover:border-[#00d4ff50] transition-colors">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-xs text-[#94a3b8] mb-2">{label}</div>
      <div className="text-2xl font-bold font-mono tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
