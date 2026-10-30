"use client";

import { ArrowUpRight, Quote } from "lucide-react";
import type { DraftRisk } from "@/lib/schemas";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RiskTypeBadge } from "@/components/badges";
import { cn } from "@/lib/utils";

const SEVERITY_LABEL: Record<DraftRisk["severity"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export function RiskEditorCard({
  risk,
  taskTitle,
  active,
  readOnly,
  onToggle,
  onActivate,
}: {
  risk: DraftRisk;
  taskTitle: string | null;
  active: boolean;
  readOnly: boolean;
  onToggle: (next: boolean) => void;
  onActivate: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-l-2 p-3.5 transition-opacity sm:p-4",
        risk.type === "owner_gap" || risk.type === "due_conflict"
          ? "border-l-risk"
          : risk.type === "due_unclear"
            ? "border-l-amber-400"
            : "border-l-blue-400",
        active && "ring-1 ring-signal-strong/50",
        !risk.include && "opacity-55",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <RiskTypeBadge value={risk.type} />
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-faint">
            严重度 {SEVERITY_LABEL[risk.severity]}
          </span>
          {!risk.include ? (
            <span className="rounded-full border border-line px-2 py-0.5 text-[9px] text-ink-muted">
              不写入
            </span>
          ) : null}
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] text-ink-muted">写入</span>
          <Switch
            checked={risk.include}
            onCheckedChange={onToggle}
            disabled={readOnly}
            label={`是否写入风险：${risk.title}`}
          />
        </label>
      </div>

      <p className="mt-2 text-[13px] font-medium leading-5 text-ink">
        {risk.title}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-ink-muted">{risk.detail}</p>

      {risk.sourceQuote ? (
        <div className="mt-2 flex gap-1.5 rounded-lg bg-canvas/80 p-2">
          <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0 text-ink-faint" />
          <p className="text-[11px] leading-5 text-ink-soft">
            {risk.sourceQuote}
          </p>
        </div>
      ) : null}

      {taskTitle ? (
        <button
          type="button"
          onClick={onActivate}
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          关联任务：{taskTitle}
          <ArrowUpRight className="h-2.5 w-2.5" />
        </button>
      ) : (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
          项目级风险 · 未绑定任务
        </p>
      )}
    </Card>
  );
}
