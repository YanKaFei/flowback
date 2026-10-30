"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Loader2,
  Quote,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { RiskRecord, TaskEventRecord, TaskRecord } from "@/lib/repo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ConfidenceBadge,
  RiskStatusBadge,
  RiskTypeBadge,
  StatusBadge,
} from "@/components/badges";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface FormState {
  title: string;
  owner: string;
  dueLabel: string;
  dueDate: string;
  priority: TaskRecord["priority"];
  status: TaskRecord["status"];
  note: string;
}

function toForm(task: TaskRecord): FormState {
  return {
    title: task.title,
    owner: task.owner ?? "",
    dueLabel: task.dueLabel ?? "",
    dueDate: task.dueDate ?? "",
    priority: task.priority,
    status: task.status,
    note: task.note ?? "",
  };
}

const EVENT_LABEL: Record<string, string> = {
  created: "任务创建",
  updated: "字段更新",
  status_changed: "状态变更",
};

export function TaskDialog({
  task,
  risks,
  events,
  onClose,
  onSaved,
}: {
  task: TaskRecord | null;
  risks: RiskRecord[];
  events: TaskEventRecord[];
  onClose: () => void;
  onSaved: (task: TaskRecord) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setForm(task ? toForm(task) : null);
    setError(null);
  }, [task]);

  const linkedRisks = React.useMemo(
    () => (task ? risks.filter((risk) => risk.taskId === task.id) : []),
    [risks, task],
  );
  const taskEvents = React.useMemo(
    () => (task ? events.filter((event) => event.taskId === task.id).slice(0, 6) : []),
    [events, task],
  );

  function patch(next: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...next } : current));
  }

  async function save() {
    if (!task || !form || saving) return;
    if (!form.title.trim()) {
      setError("任务名称不能为空。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          owner: form.owner.trim() || null,
          dueLabel: form.dueLabel.trim() || null,
          dueDate: form.dueDate || null,
          priority: form.priority,
          status: form.status,
          note: form.note.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { task?: TaskRecord; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.task) {
        setError(data?.error?.message ?? "保存失败，请稍后重试。");
        return;
      }
      onSaved(data.task);
      toast({
        title: "任务已更新",
        description: "修改已写入本地 SQLite，刷新后仍然保留。",
        tone: "success",
      });
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `网络请求失败：${requestError.message}`
          : "网络请求失败，请稍后重试。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        {task && form ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge value={task.status} />
                <ConfidenceBadge value={task.confidence} />
                {task.needsConfirmation ? (
                  <Badge variant="dashed">需核对</Badge>
                ) : null}
              </div>
              <DialogTitle>任务详情</DialogTitle>
              <DialogDescription>
                修改会立即写入本地数据库，并记录一条任务事件。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <Label className="mb-1.5 block">任务名称</Label>
                <Input
                  value={form.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  maxLength={120}
                />
              </label>
              <label>
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <UserRound className="h-3 w-3" />
                  负责人
                </Label>
                <Input
                  value={form.owner}
                  onChange={(event) => patch({ owner: event.target.value })}
                  placeholder="留空表示无人负责"
                  maxLength={40}
                />
              </label>
              <label>
                <Label className="mb-1.5 flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" />
                  截止时间（原文）
                </Label>
                <Input
                  value={form.dueLabel}
                  onChange={(event) => patch({ dueLabel: event.target.value })}
                  placeholder="如 周四 / 周五前"
                  maxLength={40}
                />
              </label>
              <label>
                <Label className="mb-1.5">具体日期</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => patch({ dueDate: event.target.value })}
                />
              </label>
              <label>
                <Label className="mb-1.5">优先级</Label>
                <Select
                  value={form.priority}
                  onChange={(event) =>
                    patch({ priority: event.target.value as TaskRecord["priority"] })
                  }
                >
                  <option value="high">高优先</option>
                  <option value="medium">中优先</option>
                  <option value="low">低优先</option>
                </Select>
              </label>
              <label>
                <Label className="mb-1.5">状态</Label>
                <Select
                  value={form.status}
                  onChange={(event) =>
                    patch({ status: event.target.value as TaskRecord["status"] })
                  }
                >
                  <option value="todo">待处理</option>
                  <option value="doing">进行中</option>
                  <option value="done">已完成</option>
                </Select>
              </label>
              <label>
                <Label className="mb-1.5">备注</Label>
                <Input
                  value={form.note}
                  onChange={(event) => patch({ note: event.target.value })}
                  placeholder="执行备注（可选）"
                  maxLength={300}
                />
              </label>
            </div>

            {form.status === "done" && !task.evidenceQuote ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                该任务没有原文完成证据。手动标记完成会被记录为人工操作，但无法追溯到原句。
              </p>
            ) : null}

            <div className="rounded-xl border border-line bg-canvas/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="quote-mark inline-flex items-center gap-1">
                  <Quote className="h-2.5 w-2.5" />
                  原文引用
                </span>
                {task.speaker ? (
                  <span className="text-[10px] text-ink-muted">{task.speaker}</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[12px] leading-5 text-ink-soft">
                {task.sourceQuote ? `“${task.sourceQuote}”` : "（无原文引用）"}
              </p>
              {task.evidenceQuote ? (
                <p className="mt-2 border-t border-line pt-2 text-[11px] leading-5 text-ok">
                  完成证据：“{task.evidenceQuote}”
                </p>
              ) : null}
              {task.extractionId ? (
                <Link
                  href={`/review/${task.extractionId}`}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  查看来源审核记录
                  <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              ) : null}
            </div>

            {linkedRisks.length > 0 ? (
              <div className="rounded-xl border border-risk-border bg-risk-soft/40 p-3.5">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-3 w-3 text-risk" />
                  <span className="text-[11px] font-medium text-ink">
                    关联风险（{linkedRisks.length}）
                  </span>
                </div>
                <ul className="mt-2 space-y-2">
                  {linkedRisks.map((risk) => (
                    <li
                      key={risk.id}
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <RiskTypeBadge value={risk.type} />
                      <span className="text-[11px] text-ink-soft">{risk.title}</span>
                      <RiskStatusBadge value={risk.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {taskEvents.length > 0 ? (
              <div>
                <p className="eyebrow mb-2">EVENTS / 事件记录</p>
                <ul className="space-y-1.5">
                  {taskEvents.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-start gap-2 text-[10px] leading-4 text-ink-muted"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                      <span className="min-w-0">
                        <span className="font-medium text-ink-soft">
                          {EVENT_LABEL[event.type] ?? event.type}
                        </span>
                        {event.type === "status_changed" && event.fromValue ? (
                          <>
                            {" "}
                            {event.fromValue} → {event.toValue}
                          </>
                        ) : null}
                        {event.note ? <> · {event.note}</> : null}
                        <span className="ml-1 font-mono text-[9px] text-ink-faint">
                          {new Date(event.createdAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-ink-faint">
                <Clock3 className="h-3 w-3" />
                暂无事件记录
              </div>
            )}

            {error ? (
              <p className="rounded-lg border border-risk-border bg-risk-soft px-3 py-2 text-[11px] text-risk-strong">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="signal"
                onClick={save}
                disabled={saving}
                className={cn(saving && "min-w-[120px]")}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    保存修改
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
