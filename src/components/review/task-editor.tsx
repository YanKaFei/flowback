"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Crosshair,
  Flag,
  ListChecks,
  Quote,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import type { DraftTask } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  ConfidenceBadge,
  DATE_STATUS_LABEL,
  DateBadge,
} from "@/components/badges";
import { cn } from "@/lib/utils";

export function TaskEditorCard({
  task,
  index,
  active,
  readOnly,
  riskCount,
  onChange,
  onRemove,
  onActivate,
  onLocate,
}: {
  task: DraftTask;
  index: number;
  active: boolean;
  readOnly: boolean;
  riskCount: number;
  onChange: (patch: Partial<DraftTask>) => void;
  onRemove: () => void;
  onActivate: () => void;
  onLocate: () => void;
}) {
  const doneWithoutEvidence =
    task.status === "done" && !task.evidenceQuote?.trim();

  return (
    <Card
      className={cn(
        "overflow-hidden transition-[box-shadow,border-color]",
        active
          ? "border-signal-strong/50 ring-1 ring-signal-strong/60"
          : "hover:border-line-strong",
      )}
      onFocusCapture={onActivate}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-faint">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={task.title}
              onChange={(event) => onChange({ title: event.target.value })}
              disabled={readOnly}
              aria-label={`任务 ${index + 1} 名称`}
              className="w-full min-w-0 rounded-sm border-0 bg-transparent p-0 text-[15px] font-semibold leading-6 tracking-tight text-ink placeholder:text-ink-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 disabled:opacity-100"
              placeholder="任务名称"
            />
          </div>
          {!readOnly ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onLocate}
                title="在原文中定位"
                aria-label="在原文中定位"
              >
                <Crosshair className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onRemove}
                title="不创建此任务"
                aria-label="删除此任务"
                className="hover:text-risk"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0 sm:pl-[26px]">
          <ConfidenceBadge value={task.confidence} />
          <DateBadge dateStatus={task.dateStatus} />
          {task.needsConfirmation ? (
            <Badge variant="dashed">需人工确认</Badge>
          ) : null}
          {riskCount > 0 ? (
            <Badge variant="risk">{riskCount} 条关联风险</Badge>
          ) : null}
          {doneWithoutEvidence ? (
            <Badge variant="amber">
              <AlertTriangle className="h-2.5 w-2.5" />
              缺少完成证据
            </Badge>
          ) : null}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <Field icon={UserRound} label="负责人">
            <Input
              value={task.owner ?? ""}
              onChange={(event) =>
                onChange({ owner: event.target.value || null })
              }
              disabled={readOnly}
              placeholder="未指派"
              className={cn(
                "h-9 text-[13px]",
                !task.owner && "border-risk-border bg-risk-soft/40",
              )}
            />
          </Field>
          <Field icon={CalendarDays} label="截止（原文）">
            <Input
              value={task.dueLabel ?? ""}
              onChange={(event) =>
                onChange({ dueLabel: event.target.value || null })
              }
              disabled={readOnly}
              placeholder="如 周四 / 周五前"
              className="h-9 text-[13px]"
            />
          </Field>
          <Field icon={CalendarDays} label="具体日期（可选）">
            <Input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(event) =>
                onChange({ dueDate: event.target.value || null })
              }
              disabled={readOnly}
              className="h-9 text-[13px]"
            />
          </Field>
          <Field icon={Flag} label="优先级">
            <Select
              value={task.priority}
              onChange={(event) =>
                onChange({
                  priority: event.target.value as DraftTask["priority"],
                })
              }
              disabled={readOnly}
              className="h-9 text-[13px]"
            >
              <option value="high">高优先</option>
              <option value="medium">中优先</option>
              <option value="low">低优先</option>
            </Select>
          </Field>
          <Field icon={ListChecks} label="状态">
            <Select
              value={task.status}
              onChange={(event) =>
                onChange({ status: event.target.value as DraftTask["status"] })
              }
              disabled={readOnly}
              className="h-9 text-[13px]"
            >
              <option value="todo">待处理</option>
              <option value="doing">进行中</option>
              <option value="done">已完成</option>
            </Select>
          </Field>
          <Field icon={CheckCircle2} label="依据强度">
            <Select
              value={task.confidence}
              onChange={(event) =>
                onChange({
                  confidence: event.target.value as DraftTask["confidence"],
                })
              }
              disabled={readOnly}
              className="h-9 text-[13px]"
            >
              <option value="explicit">明确结论</option>
              <option value="inferred">模型推断</option>
              <option value="unconfirmed">待确认</option>
            </Select>
          </Field>
        </div>

        {task.dateStatus !== "confirmed" ? (
          <p className="mt-2 text-[10px] leading-4 text-amber-800">
            {DATE_STATUS_LABEL[task.dateStatus]}
            {task.dateStatus === "relative"
              ? "：原文只有“周几”等相对说法，建议补成具体日期，或在看板保留待核对标记。"
              : "：原文没有给出时间，确认后会在风险中心显示。"}
          </p>
        ) : null}

        <div className="mt-3 rounded-xl border border-line bg-canvas/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="quote-mark inline-flex items-center gap-1">
              <Quote className="h-2.5 w-2.5" />
              原文引用
            </span>
            {task.speaker ? (
              <span className="text-[10px] text-ink-muted">
                {task.speaker}
                {task.sourceQuote ? " · 逐字引用" : ""}
              </span>
            ) : null}
          </div>
          {task.sourceQuote ? (
            <p className="mt-1.5 text-[12px] leading-5 text-ink-soft">
              “{task.sourceQuote}”
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-5 text-risk">
              缺少原文引用，该任务无法追溯来源，请谨慎确认。
            </p>
          )}
        </div>

        {task.status === "done" ? (
          <div
            className={cn(
              "mt-2.5 rounded-xl border p-3",
              doneWithoutEvidence
                ? "border-risk-border bg-risk-soft"
                : "border-ok-border bg-ok-soft/60",
            )}
          >
            <div className="flex items-center gap-1.5">
              {doneWithoutEvidence ? (
                <AlertTriangle className="h-3 w-3 text-risk" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-ok" />
              )}
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-soft">
                完成证据（必须逐字引用）
              </span>
            </div>
            <Input
              value={task.evidenceQuote ?? ""}
              onChange={(event) =>
                onChange({ evidenceQuote: event.target.value || null })
              }
              disabled={readOnly}
              placeholder="粘贴原文中的完成句，例如“已发到你邮箱了”"
              className="mt-2 h-8 border-ink/10 bg-surface text-[12px]"
            />
            <p className="mt-1.5 text-[10px] leading-4 text-ink-muted">
              “收到 / 好的 / 嗯”只代表知悉，不是完成证据；缺少证据时确认会被拦下。
            </p>
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <Input
            value={task.note ?? ""}
            onChange={(event) =>
              onChange({ note: event.target.value || null })
            }
            disabled={readOnly}
            placeholder="审核备注 / 上下文说明（可选）"
            className="h-8 border-transparent bg-transparent px-1 text-[12px] focus-visible:border-line hover:bg-canvas/60"
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <p className="text-[11px] font-medium text-ink-soft">字段待人工确认</p>
            <p className="mt-0.5 text-[10px] text-ink-muted">
              勾选后会在看板保留“需核对”标记
            </p>
          </div>
          <Switch
            checked={task.needsConfirmation}
            onCheckedChange={(next) => onChange({ needsConfirmation: next })}
            disabled={readOnly}
            label="字段待人工确认"
          />
        </div>
      </div>
    </Card>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
      {children}
    </label>
  );
}
