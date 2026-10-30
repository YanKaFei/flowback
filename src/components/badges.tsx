import type {
  Confidence,
  DateStatus,
  Priority,
  RiskStatus,
  RiskType,
  TaskStatus,
  AnalysisMode,
} from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CircleDot, FlaskConical, Sparkles, TriangleAlert } from "lucide-react";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  explicit: "明确结论",
  inferred: "模型推断",
  unconfirmed: "待确认",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "待处理",
  doing: "进行中",
  done: "已完成",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高优先",
  medium: "中优先",
  low: "低优先",
};

export const RISK_TYPE_LABEL: Record<RiskType, string> = {
  owner_gap: "无人负责",
  due_conflict: "时间冲突",
  due_unclear: "截止待定",
  decision_unconfirmed: "待核对决策",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open: "待处理",
  acknowledged: "已确认知悉",
  resolved: "已解决",
};

export const DATE_STATUS_LABEL: Record<DateStatus, string> = {
  confirmed: "日期明确",
  relative: "相对日期",
  unknown: "无日期",
};

export function ConfidenceBadge({
  value,
  className,
}: {
  value: Confidence;
  className?: string;
}) {
  const variant =
    value === "explicit" ? "outline" : value === "inferred" ? "blue" : "amber";
  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      {value === "explicit" ? (
        <CircleDot className="h-2.5 w-2.5" />
      ) : value === "inferred" ? (
        <Sparkles className="h-2.5 w-2.5" />
      ) : (
        <TriangleAlert className="h-2.5 w-2.5" />
      )}
      {CONFIDENCE_LABEL[value]}
    </Badge>
  );
}

export function StatusBadge({
  value,
  className,
}: {
  value: TaskStatus;
  className?: string;
}) {
  const variant = value === "done" ? "ok" : value === "doing" ? "blue" : "muted";
  return (
    <Badge variant={variant} className={className}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          value === "done"
            ? "bg-ok"
            : value === "doing"
              ? "bg-info"
              : "bg-ink-faint",
        )}
      />
      {TASK_STATUS_LABEL[value]}
    </Badge>
  );
}

export function PriorityBadge({
  value,
  className,
}: {
  value: Priority;
  className?: string;
}) {
  const variant = value === "high" ? "risk" : value === "medium" ? "muted" : "outline";
  return (
    <Badge variant={variant} className={className}>
      {PRIORITY_LABEL[value]}
    </Badge>
  );
}

export function RiskTypeBadge({
  value,
  className,
}: {
  value: RiskType;
  className?: string;
}) {
  const variant =
    value === "owner_gap" || value === "due_conflict"
      ? "risk"
      : value === "due_unclear"
        ? "amber"
        : "blue";
  return (
    <Badge variant={variant} className={className}>
      {RISK_TYPE_LABEL[value]}
    </Badge>
  );
}

export function RiskStatusBadge({
  value,
  className,
}: {
  value: RiskStatus;
  className?: string;
}) {
  const variant =
    value === "resolved" ? "ok" : value === "acknowledged" ? "outline" : "muted";
  return (
    <Badge variant={variant} className={className}>
      {RISK_STATUS_LABEL[value]}
    </Badge>
  );
}

export function ModeBadge({
  mode,
  model,
  className,
}: {
  mode: AnalysisMode;
  model?: string | null;
  className?: string;
}) {
  if (mode === "ai") {
    return (
      <Badge variant="signal" className={className}>
        <Sparkles className="h-2.5 w-2.5" />
        真实 AI{model ? ` · ${model}` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="amber" className={className}>
      <FlaskConical className="h-2.5 w-2.5" />
      示例模式 · 非 AI
    </Badge>
  );
}

export function DateBadge({
  dateStatus,
  className,
}: {
  dateStatus: DateStatus;
  className?: string;
}) {
  if (dateStatus === "confirmed") return null;
  return (
    <Badge
      variant={dateStatus === "relative" ? "amber" : "risk"}
      className={cn("gap-1", className)}
    >
      {DATE_STATUS_LABEL[dateStatus]}
    </Badge>
  );
}
