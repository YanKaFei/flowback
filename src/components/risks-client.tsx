"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ProjectSummary, RiskRecord, TaskRecord } from "@/lib/repo";
import type { RiskType } from "@/lib/schemas";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  RiskStatusBadge,
  RiskTypeBadge,
  StatusBadge,
} from "@/components/badges";
import { useToast } from "@/components/ui/toast";
import { cn, shortDate } from "@/lib/utils";

type Filter = "all" | RiskType | "resolved";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "owner_gap", label: "无人负责" },
  { key: "due_conflict", label: "时间冲突" },
  { key: "due_unclear", label: "截止待定" },
  { key: "decision_unconfirmed", label: "待核对决策" },
  { key: "resolved", label: "已解决" },
];

const SEVERITY_LABEL: Record<RiskRecord["severity"], string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const STATUS_ORDER: Record<RiskRecord["status"], number> = {
  open: 0,
  acknowledged: 1,
  resolved: 2,
};

const SEVERITY_ORDER: Record<RiskRecord["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function RisksClient({
  project,
  tasks,
  risks: initialRisks,
  aiConfigured,
  model,
}: {
  project: ProjectSummary;
  tasks: TaskRecord[];
  risks: RiskRecord[];
  aiConfigured: boolean;
  model: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [risks, setRisks] = React.useState(initialRisks);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState({
    title: "",
    detail: "",
    note: "",
  });

  React.useEffect(() => {
    setRisks(initialRisks);
  }, [initialRisks]);

  async function patchRisk(
    risk: RiskRecord,
    patch: {
      status?: RiskRecord["status"];
      title?: string;
      detail?: string;
      note?: string | null;
    },
    successTitle: string,
  ) {
    if (savingId) return;
    setSavingId(risk.id);
    try {
      const response = await fetch(`/api/risks/${encodeURIComponent(risk.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json().catch(() => null)) as
        | { risk?: RiskRecord; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.risk) {
        throw new Error(data?.error?.message ?? "操作失败");
      }
      setRisks((current) =>
        current.map((item) => (item.id === risk.id ? data.risk! : item)),
      );
      setEditingId(null);
      toast({ title: successTitle, tone: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        tone: "error",
      });
    } finally {
      setSavingId(null);
    }
  }

  function startEdit(risk: RiskRecord) {
    setEditingId(risk.id);
    setDraft({
      title: risk.title,
      detail: risk.detail,
      note: risk.resolutionNote ?? "",
    });
  }

  const counts = React.useMemo(() => {
    const open = risks.filter((risk) => risk.status !== "resolved");
    return {
      all: risks.length,
      owner_gap: open.filter((risk) => risk.type === "owner_gap").length,
      due_conflict: open.filter((risk) => risk.type === "due_conflict").length,
      due_unclear: open.filter((risk) => risk.type === "due_unclear").length,
      decision_unconfirmed: open.filter(
        (risk) => risk.type === "decision_unconfirmed",
      ).length,
      resolved: risks.filter((risk) => risk.status === "resolved").length,
    } satisfies Record<Filter, number>;
  }, [risks]);

  const filtered = React.useMemo(() => {
    const list =
      filter === "all"
        ? risks
        : filter === "resolved"
          ? risks.filter((risk) => risk.status === "resolved")
          : risks.filter(
              (risk) => risk.type === filter && risk.status !== "resolved",
            );
    return [...list].sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }, [filter, risks]);

  const activeRisks = filtered.filter((risk) => risk.status !== "resolved");
  const resolvedRisks = filtered.filter((risk) => risk.status === "resolved");
  const openCount = risks.filter((risk) => risk.status !== "resolved").length;

  function renderRisk(risk: RiskRecord) {
    const task = tasks.find((item) => item.id === risk.taskId);
    const editing = editingId === risk.id;
    const saving = savingId === risk.id;
    const resolved = risk.status === "resolved";

    return (
      <Card
        key={risk.id}
        className={cn(
          "border-l-2 p-4 transition-opacity sm:p-5",
          resolved
            ? "border-l-ok/50 opacity-80"
            : risk.type === "owner_gap" || risk.type === "due_conflict"
              ? "border-l-risk"
              : risk.type === "due_unclear"
                ? "border-l-amber-400"
                : "border-l-blue-400",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <RiskTypeBadge value={risk.type} />
            <Badge variant="outline">严重度 {SEVERITY_LABEL[risk.severity]}</Badge>
            <RiskStatusBadge value={risk.status} />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-faint">
            {shortDate(risk.createdAt)} · {risk.type}
          </span>
        </div>

        <h3
          className={cn(
            "mt-2.5 text-[15px] font-semibold leading-6 tracking-tight text-ink",
            resolved && "text-ink-muted line-through decoration-ink/20",
          )}
        >
          {risk.title}
        </h3>
        <p className="mt-1 text-[12px] leading-6 text-ink-muted">{risk.detail}</p>

        <div className="mt-3 flex gap-2 rounded-xl border border-line bg-canvas/70 p-3">
          <span className="quote-mark mt-0.5 shrink-0">原文</span>
          <div className="min-w-0">
            <p className="text-[12px] leading-6 text-ink-soft">
              {risk.sourceQuote
                ? `“${risk.sourceQuote}”`
                : "（缺少原文引用，请人工补全）"}
            </p>
            {risk.extractionId ? (
              <Link
                href={`/review/${risk.extractionId}`}
                className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                查看来源审核存档
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            ) : null}
          </div>
        </div>

        {risk.status === "acknowledged" && risk.resolutionNote ? (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-info" />
            <p className="text-[11px] leading-5 text-info">
              处理记录：{risk.resolutionNote}
            </p>
          </div>
        ) : null}

        {resolved && (risk.resolutionNote || risk.resolvedAt) ? (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-ok-border bg-ok-soft px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-ok" />
            <p className="text-[11px] leading-5 text-ok">
              已解决
              {risk.resolvedAt ? ` · ${shortDate(risk.resolvedAt)}` : ""}
              {risk.resolutionNote ? ` · ${risk.resolutionNote}` : ""}
            </p>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {task ? (
              <>
                <Link
                  href={`/dashboard/${project.id}#task-${task.id}`}
                  className="max-w-[240px] truncate text-[11px] font-medium text-ink-soft underline-offset-4 hover:underline"
                >
                  {task.title}
                </Link>
                <StatusBadge value={task.status} />
                <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
                  {task.owner ? (
                    <>
                      <UserRound className="h-2.5 w-2.5" />
                      {task.owner}
                    </>
                  ) : (
                    <span className="font-medium text-risk">无人负责</span>
                  )}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-ink-muted">
                项目级风险 · 未绑定任务
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {!resolved ? (
              <>
                {risk.status === "open" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() =>
                      void patchRisk(
                        risk,
                        { status: "acknowledged" },
                        "已确认知悉，风险仍保持打开",
                      )
                    }
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    确认知悉
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    void patchRisk(risk, { status: "resolved" }, "风险已标记解决")
                  }
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  标记解决
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() =>
                  void patchRisk(risk, { status: "open" }, "风险已重新打开")
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重新打开
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={editing ? "soft" : "ghost"}
              onClick={() => (editing ? setEditingId(null) : startEdit(risk))}
            >
              <PencilLine className="h-3.5 w-3.5" />
              {editing ? "收起" : "编辑"}
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  editing && "rotate-180",
                )}
              />
            </Button>
          </div>
        </div>

        {editing ? (
          <div className="mt-3 animate-fade-in rounded-xl border border-line bg-canvas/60 p-3.5">
            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
                  风险标题
                </span>
                <Input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  maxLength={120}
                  className="h-9 text-[13px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
                  风险说明
                </span>
                <Textarea
                  value={draft.detail}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      detail: event.target.value,
                    }))
                  }
                  rows={3}
                  maxLength={400}
                  className="min-h-[76px] text-[12px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.06em] text-ink-muted">
                  处理说明（可选，随风险一起保存）
                </span>
                <Input
                  value={draft.note}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  maxLength={400}
                  placeholder="例如：已和场地方确认，由陈默负责"
                  className="h-9 text-[12px]"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[10px] text-ink-faint">
                原文引用不可在此修改，保证可追溯。
              </p>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  disabled={saving}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={saving || !draft.title.trim()}
                  onClick={() => {
                    if (!draft.title.trim()) return;
                    void patchRisk(
                      risk,
                      {
                        title: draft.title.trim(),
                        detail: draft.detail.trim(),
                        note: draft.note.trim() || null,
                      },
                      "风险已更新",
                    );
                  }}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  保存修改
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        projectId={project.id}
        active="risks"
        aiConfigured={aiConfigured}
        model={model}
      />

      <main className="container flex-1 pb-20 pt-8 sm:pt-10">
        <div className="mx-auto w-full max-w-5xl">
        <Link
          href={`/dashboard/${project.id}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          返回任务看板
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">RISKS / 风险中心</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-ink sm:text-[36px]">
              风险与待核对
            </h1>
            <p className="mt-2 max-w-xl text-[12px] leading-6 text-ink-muted">
              每一条风险都引用原文，可确认知悉、修改描述或标记解决。解决后仍保留来源与处理记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={openCount > 0 ? "risk" : "ok"}>
              {openCount > 0 ? `${openCount} 项未解决` : "全部已处理"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/dashboard/${project.id}`}>
                任务看板
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="no-scrollbar mt-6 flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((item) => {
            const active = filter === item.key;
            const count = counts[item.key] ?? 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-ink bg-ink text-canvas"
                    : "border-line bg-surface text-ink-muted hover:border-ink/25 hover:text-ink",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 font-mono text-[9px]",
                    active ? "bg-canvas/20 text-canvas" : "bg-ink/[0.06] text-ink-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {filtered.length === 0 ? (
            <Card className="border-dashed p-10 text-center sm:p-14">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-canvas">
                <CheckCircle2 className="h-5 w-5 text-ok" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">
                {counts.all === 0 ? "没有发现风险" : "该分类下没有风险"}
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-ink-muted">
                {counts.all === 0
                  ? "这次导入没有识别到责任空缺、时间冲突或待核对决策。你可以在看板继续推进任务。"
                  : "切换其他分类查看，或回到看板继续推进。"}
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link href={`/dashboard/${project.id}`}>
                  回到任务看板
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {activeRisks.map(renderRisk)}
              {resolvedRisks.length > 0 && activeRisks.length > 0 ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                    已解决 · {resolvedRisks.length}
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              ) : null}
              {resolvedRisks.map(renderRisk)}
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-line bg-surface/60 p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            <div>
              <p className="text-[11px] font-medium text-ink-soft">处理原则</p>
              <p className="mt-1 text-[10px] leading-5 text-ink-muted">
                风险不会因为勾选“确认知悉”而消失；只有补齐负责人 / 日期并点击“标记解决”，或在任务中修复对应字段后，系统才会自动关闭结构性风险。所有操作都写入本地 SQLite。
              </p>
            </div>
          </div>
        </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
