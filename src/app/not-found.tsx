import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader aiConfigured={false} />
      <main className="container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-card">
          <FileQuestion className="h-6 w-6 text-ink-muted" />
        </span>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          404 / Not found
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          这条记录不存在
        </h1>
        <p className="mt-2 max-w-sm text-[13px] leading-6 text-ink-muted">
          链接可能已失效，或对应的项目 / 来源已被删除。回到首页重新导入一段对话即可。
        </p>
        <Button asChild variant="signal" className="mt-6">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </Button>
      </main>
    </div>
  );
}
