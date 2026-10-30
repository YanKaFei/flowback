"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Quote,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import type { TaskRecord } from "@/lib/repo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DateBadge,
  PRIORITY_LABEL,
  PriorityBadge,
} from "@/components/badges";
import { cn, shortDate } from "@/lib/utils";

const PRIORITY_DOT: Record<TaskRecord["priority"], string> = {
  high: "bg-risk",
  medium: "bg-amber-500",
  low: "bg-ink-faint",
};

export function BoardTaskCard({
  task,
  riskCount,
  onOpen,
  onStatus,
  busy,
}: {
  task: TaskRecord;
  riskCount: number;
  onOpen: () => void;
  onStatus: (next: TaskRecord["status"]) => void;
  busy: boolean;
}) {
  const dueText = task.dueLabel ?? (task.dueDate ? shortDate(task.dueDate) : "未定");
  const showExact = Boolean(task.dueLabel && task.dueDate);

  return (
    <Card
      id={`task-${task.id}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group cursor-pointer p-3.5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[13px] font-semibold leading-5 tracking-tight text-ink">
          {task.title}
        </p>
        <PriorityBadge value={task.priority} className="mt-0.5 shrink-0" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[task.priority])} />
          {PRIORITY_LABEL[task.priority]}
        </span>
        <span className="text-line-strong">·</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
          <CalendarDays className="h-2.5 w-2.5" />
          {dueText}
          {showExact ? (
            <span className="text-ink-faint">/ {shortDate(task.dueDate)}</span>
          ) : null}
        </span>
        <DateBadge dateStatus={task.dateStatus} className="px-1.5 py-0 text-[9px]" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
              task.owner
                ? "bg-ink/[0.07] text-ink-soft"
                : "border border-dashed border-risk-border bg-risk-soft text-risk",
            )}
          >
            {task.owner ? task.owner.slice(0, 1) : "?"}
          </span>
          <span
            className={cn(
              "truncate text-[11px]",
              task.owner ? "text-ink-soft" : "font-medium text-risk",
            )}
          >
            {task.owner ?? "无人负责"}
          </span>
        </span>
        <span className="shrink-0 text-[9px] text-ink-faint">
          更新 {shortDate(task.updatedAt)}
        </span>
      </div>

      {task.sourceQuote ? (
        <div className="mt-2.5 flex gap-1.5 rounded-lg bg-canvas/80 px-2 py-1.5">
          <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0 text-ink-faint" />
          <p className="line-clamp-2 text-[10px] leading-4 text-ink-muted">
            {task.sourceQuote}
          </p>
        </div>
      ) : null}

      {task.status === "done" ? (
        task.evidenceQuote ? (
          <div className="mt-2 rounded-lg border border-ok-border bg-ok-soft/60 px-2 py-1.5">
            <p className="flex items-start gap-1 text-[9px] leading-4 text-ok">
              <Check className="mt-0.5 h-2.5 w-2.5 shrink-0" />
              <span className="line-clamp-2">完成证据：{task.evidenceQuote}</span>
            </p>
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] leading-4 text-amber-800">
            人工标记完成 · 缺原文证据
          </p>
        )
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
        <div className="flex min-w-0 items-center gap-2">
          {riskCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-medium text-risk">
              <ShieldAlert className="h-2.5 w-2.5" />
              {riskCount} 风险
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[9px] text-ok">
              <Check className="h-2.5 w-2.5" />
              无未处理风险
            </span>
          )}
          {task.needsConfirmation ? (
            <Badge variant="dashed" className="px-1.5 py-0 text-[9px]">
              需核对
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {task.status === "todo" ? (
            <>
              <QuickAction
                label="开始"
                icon={ArrowRight}
                onClick={() => onStatus("doing")}
              />
              <QuickAction
                label="完成"
                icon={Check}
                onClick={() => onStatus("done")}
              />
            </>
          ) : null}
          {task.status === "doing" ? (
            <>
              <QuickAction
                label="完成"
                icon={Check}
                onClick={() => onStatus("done")}
              />
              <QuickAction
                label="退回"
                icon={RotateCcw}
                onClick={() => onStatus("todo")}
              />
            </>
          ) : null}
          {task.status === "done" ? (
            <QuickAction
              label="重开"
              icon={Clock3}
              onClick={() => onStatus("todo")}
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function QuickAction({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-medium text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}
