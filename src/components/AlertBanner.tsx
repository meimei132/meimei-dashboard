"use client";

import type { AlertItem } from "@/lib/types";

export default function AlertBanner({ alerts }: { alerts: AlertItem[] }) {
  if (alerts.length === 0) return null;
  
  const badNews = alerts.filter(a => a.direction === 'down');
  const goodNews = alerts.filter(a => a.direction === 'up');
  
  return (
    <div className="space-y-3 mb-4">
      {/* 预警消息 */}
      {badNews.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold text-red-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            预警消息 ({badNews.length})
          </h3>
          <div className="space-y-0.5">
            {badNews.slice(0, 5).map((a, i) => (
              <p key={i} className="text-[11px] text-red-300/80">
                [{a.severity === "critical" ? "严重" : "警告"}] {a.name}：{a.metricLabel}连续{a.days}天
                {a.metric === 'timeCost' ? '下降' : '下滑'}
                {a.changePercent && <span className="text-red-400/60"> ({a.changePercent.toFixed(1)}%)</span>}
              </p>
            ))}
            {badNews.length > 5 && <p className="text-[11px] text-red-300/60">...还有 {badNews.length - 5} 条预警</p>}
          </div>
        </div>
      )}
      
      {/* 积极信号 */}
      {goodNews.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            积极信号 ({goodNews.length})
          </h3>
          <div className="space-y-0.5">
            {goodNews.slice(0, 5).map((a, i) => (
              <p key={i} className="text-[11px] text-emerald-300/80">
                {a.name}：{a.metricLabel}连续{a.days}天上升
                {a.changePercent && <span className="text-emerald-400/60"> (+{a.changePercent.toFixed(1)}%)</span>}
              </p>
            ))}
            {goodNews.length > 5 && <p className="text-[11px] text-emerald-300/60">...还有 {goodNews.length - 5} 条积极信号</p>}
          </div>
        </div>
      )}
    </div>
  );
}
