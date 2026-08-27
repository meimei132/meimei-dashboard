"use client";

interface TrendChartProps {
  data: { date: string; value: number }[];
  title: string;
  color: string;
}

export default function TrendChart({ data, title, color }: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm">暂无数据</p>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
      <h3 className="text-sm font-medium text-slate-400 mb-2">{title}</h3>
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => {
          const height = ((d.value - min) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t transition-all hover:opacity-80"
              style={{
                height: `${Math.max(height, 5)}%`,
                backgroundColor: color,
              }}
              title={`${d.date}: ${d.value.toFixed(2)}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
