export interface SessionRecord {
  date: string; // YYYY-MM-DD
  room: string;
  streamer: string;
  timeSlot: string; // e.g. "09:00-13:00"
  consume: number;
  premium: number;
  policies: number;
  duration: number; // minutes
  roi: number;
  timeCost: number; // consume / (duration/60)
}

export interface RoomSummary {
  room: string;
  totalConsume: number;
  totalPremium: number;
  totalPolicies: number;
  totalDuration: number;
  avgRoi: number;
  avgTimeCost: number;
  streamerCount: number;
}

export interface StreamerSummary {
  streamer: string;
  room: string;
  totalConsume: number;
  totalPremium: number;
  totalPolicies: number;
  totalDuration: number;
  avgRoi: number;
  avgTimeCost: number;
  sessionCount: number;
}

export interface AlertItem {
  type: 'room' | 'streamer';
  name: string;
  room?: string;
  metric: 'roi' | 'timeCost' | 'premium' | 'consume';
  metricLabel: string;
  days: number;
  trend: number[];
  severity: 'warning' | 'critical';
  direction: 'up' | 'down'; // up=好消息，down=坏消息
  changePercent?: number; // 变化百分比，用于显示程度
}

export interface DailyTrend {
  date: string;
  consume: number;
  premium: number;
  policies: number;
  duration: number;
  roi: number;
  timeCost: number;
}

export interface ScheduleSlot {
  timeSlot: string;
  startHour: number;
  endHour: number;
  streamer: string;
  room: string;
  suggestedBy: 'history' | 'auto';
}
