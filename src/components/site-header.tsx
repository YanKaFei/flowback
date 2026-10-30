import Link from "next/link";
import { Plus } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { cn } from "@/lib/utils";

type Active = "home" | "dashboard" | "risks";

export function SiteHeader({
  projectId,
  active,
  aiConfigured,
  model,
}: {
  projectId?: string;
  active?: Active;
  aiConfigured: boolean;
  model?: string;
}) {
  const nav = [
    { key: "home" as const, label: "首页", href: "/" },
    ...(projectId
      ? [
          {
            key: "dashboard" as const,
            label: "任务看板",
            href: `/dashboard/${projectId}`,
          },
          {
            key: "risks" as const,
            label: "风险中心",
            href: `/risks/${projectId}`,
          },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          aria-label="FlowBack 首页"
        >
          <BrandLockup />
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full border border-line bg-surface/70 p-1 sm:flex"
          aria-label="主导航"
        >
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                active === item.key
                  ? "bg-ink text-canvas"
                  : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {projectId && active !== "home" ? (
            <Link
              href={`/?project=${projectId}`}
              className="hidden items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink/30 hover:text-ink md:inline-flex"
            >
              <Plus className="h-3 w-3" />
              导入新对话
            </Link>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
              aiConfigured
                ? "border-ok-border bg-ok-soft text-ok"
                : "border-risk-border bg-risk-soft text-risk-strong",
            )}
            title={
              aiConfigured
                ? `DeepSeek ${model ?? ""} 已配置，服务端调用`
                : "未检测到 DEEPSEEK_API_KEY，仅可运行明确标注的示例解析"
            }
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                aiConfigured
                  ? "animate-pulse-dot bg-ok"
                  : "animate-pulse-dot bg-risk",
              )}
            />
            {aiConfigured ? "AI 已连接" : "示例模式"}
          </span>
        </div>
      </div>

      {projectId ? (
        <nav
          className="container flex items-center gap-1 overflow-x-auto pb-2 sm:hidden"
          aria-label="移动端导航"
        >
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                active === item.key
                  ? "bg-ink text-canvas"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
          {active !== "home" ? (
            <Link
              href={`/?project=${projectId}`}
              className="rounded-full px-3 py-1 text-xs font-medium text-ink-muted"
            >
              + 导入
            </Link>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
