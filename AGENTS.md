# AGENTS.md

## 项目概览
直播数据大屏 - 直播公司运营数据可视化平台，包含5个页面：
1. **数据总览** (`/`) - 当月汇总、当日排名、预警面板、ROI/时耗/消耗趋势
2. **直播间分析** (`/room`) - 分直播间筛选、主播排名、分天数据、主播对比
3. **主播分析** (`/streamer`) - 分主播筛选、历史趋势、直播间表现
4. **智能排班** (`/schedule`) - 基于历史时段偏好的班次建议（4小时/班次）
5. **年度数据** (`/yearly`) - 年度汇总、按月趋势、直播间/主播对比

## 技术栈
- Next.js 16 (App Router) + React 19 + TypeScript 5
- ECharts (echarts-for-react) - 图表
- shadcn/ui + Tailwind CSS 4 - UI
- 深色指挥中心主题

## 核心文件
- `src/lib/types.ts` - 类型定义 (SessionRecord, RoomSummary, StreamerSummary, DailyTrend, AlertItem, ScheduleItem)
- `src/lib/mock-data.ts` - 飞书文档导入的真实数据（9978条记录，2个直播间，24位主播）
- `src/lib/data-utils.ts` - 工具函数（聚合、预警检测、格式化、日期比较）
- `src/components/TrendChart.tsx` - ECharts趋势图组件
- `src/app/page.tsx` - 数据总览页
- `src/app/room/page.tsx` - 直播间分析页
- `src/app/streamer/page.tsx` - 主播分析页
- `src/app/schedule/page.tsx` - 智能排班页
- `src/app/yearly/page.tsx` - 年度数据页
- `scripts/fetch-from-doc.js` - 飞书数据抓取脚本

## 构建与运行
- 开发: `pnpm dev` (端口从 DEPLOY_RUN_PORT 读取)
- 构建: `pnpm build`
- 启动: `pnpm start`
- 检查: `pnpm ts-check && pnpm lint:build`
- 更新数据: `node scripts/fetch-from-doc.js`

## 数据源
- 数据来自飞书电子表格 API（`scripts/fetch-from-doc.js` 抓取）
- 2个直播间：平安健康-E生保（9728条）、平安健康-全家保（250条）
- 24位主播
- 日期范围：2025.6.1 ~ 2026.8.25
- 每条记录代表1小时直播
- 飞书 App ID: `cli_aafb3dec53f89bea`
- 文档 Token: `BmeXwIVhziP867kk5DvcUEPCnuc`

## 核心指标
消耗(consume)、保费(premium)、保单数(policies)、直播时长(duration)、ROI、时耗(time_cost)

## 预警系统
- 检测最近3天有数据的主播/直播间
- 坏消息：ROI连续3天下降、时耗连续3天上升
- 积极信号：ROI连续3天上升、时耗连续3天下降
- 分开显示，互不干扰

## 智能排班
- 基于主播历史时段偏好推荐
- 4小时/班次
- 只推荐主播实际播过的时段
