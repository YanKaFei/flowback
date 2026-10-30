import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "FlowBack 回响 · 把聊天变成可执行任务",
  description:
    "FlowBack 将聊天文字与截图转化为可审核、可执行、可追溯的任务看板，并自动识别责任空缺、时间冲突与未确认决策。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
