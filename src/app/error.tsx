"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-risk-border bg-risk-soft">
        <AlertTriangle className="h-6 w-6 text-risk" />
      </span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
        500 / Something broke
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        页面加载失败
      </h1>
      <p className="mt-2 max-w-md text-[13px] leading-6 text-ink-muted">
        本地服务或 SQLite 数据库出现了问题。请检查终端日志；如果是首次运行，确认{" "}
        <code className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[11px]">
          data/
        </code>{" "}
        目录可写。
      </p>
      <p className="mt-2 max-w-md break-all font-mono text-[10px] text-ink-faint">
        {error.message}
      </p>
      <Button variant="signal" className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        重试
      </Button>
    </div>
  );
}
