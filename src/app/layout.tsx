import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "美魅数据大屏",
  description: "美魅直播运营数据可视化大屏",
  other: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <nav className="sticky top-0 z-50 border-b border-cyan-500/20 bg-gray-950/95 backdrop-blur-md shadow-lg shadow-cyan-500/5">
          <div className="mx-auto max-w-[1920px] px-6 py-3">
            {/* 第一行：标题 */}
            <div className="flex items-center justify-center pb-2">
              <span className="text-3xl font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                美魅数据大屏
              </span>
            </div>
            {/* 第二行：四个页面按钮 */}
            <div className="flex items-center justify-center gap-3">
              <Link href="/" className="rounded-lg border border-transparent px-5 py-1.5 text-base font-semibold text-gray-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
                数据总览
              </Link>
              <Link href="/room" className="rounded-lg border border-transparent px-5 py-1.5 text-base font-semibold text-gray-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
                直播间分析
              </Link>
              <Link href="/streamer" className="rounded-lg border border-transparent px-5 py-1.5 text-base font-semibold text-gray-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
                主播分析
              </Link>
              <Link href="/yearly" className="rounded-lg border border-transparent px-5 py-1.5 text-base font-semibold text-gray-300 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
                年度数据
              </Link>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-[1920px] p-4">{children}</main>
      </body>
    </html>
  );
}
