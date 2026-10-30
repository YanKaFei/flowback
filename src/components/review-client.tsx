"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type {
  AnalysisMode,
  DraftRisk,
  DraftTask,
  ExtractionPayload,
} from "@/lib/schemas";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ModeBadge } from "@/components/badges";
import { TranscriptPanel } from "@/components/review/transcript";
import { TaskEditorCard } from "@/components/review/task-editor";
import { RiskEditorCard } from "@/components/review/risk-editor";
import { cn } from "@/lib/utils";

export interface ReviewSource {
  id: string;
  kind: string;
  rawText: string;
  images: Array<{ name: string; mime: string }>;
  mode: AnalysisMode;
  model: string | null;
  createdAt: string;
}

export interface ReviewExtraction {
  id: string;
  status: "draft" | "confirmed";
  summary: string;
  payload: ExtractionPayload;
  warnings: string[];
  mode: AnalysisMode;
  model: string | null;
  createdAt: string;
}

export function ReviewClient({
  project,
  source,
  extraction,
  aiConfigured,
}: {
  project: { id: string; name: string };
  source: ReviewSource;
  extraction: ReviewExtraction;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const readOnly = extraction.status === "confirmed";

  const [tasks, setTasks] = React.useState<DraftTask[]>(
    extraction.payload.tasks,
  );
  const [risks, setRisks] = React.useState<DraftRisk[]>(
    extraction.payload.risks,
  );
  const [summary, setSummary] = React.useState(extraction.summary);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(
    extraction.payload.tasks[0]?.id ?? null,
  );
  const [dirty, setDirty] = React.useState(false);
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!dirty || readOnly) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(
          `/api/extractions/${encodeURIComponent(extraction.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks, risks, summary }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(data?.error?.message ?? "草稿保存失败");
        }
        setSaveState("saved");
        setDirty(false);
      } catch {
        if (!controller.signal.aborted) setSaveState("error");
      }
    }, 800);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dirty, extraction.id, readOnly, risks, summary, tasks]);

  function markDirty() {
    setDirty(true);
    setSaveState("idle");
  }

  function patchTask(id: string, patch: Partial<DraftTask>) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const next = { ...task, ...patch };
        if (patch.dueDate !== undefined) {
          next.dateStatus = next.dueDate
            ? "confirmed"
            : next.dueLabel
              ? "relative"
              : "unknown";
        } else if (patch.dueLabel !== undefined) {
          next.dateStatus = next.dueDate
            ? "confirmed"
            : next.dueLabel
              ? "relative"
              : "unknown";
        }
        return next;
      }),
    );
    markDirty();
  }

  function removeTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
    setRisks((current) => current.filter((risk) => risk.taskRef !== id));
    if (activeTaskId === id) setActiveTaskId(null);
    markDirty();
  }

  function toggleRisk(id: string, next: boolean) {
    setRisks((current) =>
      current.map((risk) =>
        risk.id === id ? { ...risk, include: next } : risk,
      ),
    );
    markDirty();
  }

  function locateTask(id: string) {
    setActiveTaskId(id);
    window.setTimeout(() => {
      document
        .getElementById(`quote-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }

  async function confirm() {
    if (readOnly || confirming) return;
    setError(null);

    if (tasks.length === 0) {
      setError("至少保留一个任务才能确认入库。");
      return;
    }
    if (tasks.some((task) => !task.title.trim())) {
      setError("存在未命名的任务，请补充任务名称后再确认。");
      return;
    }
    const acknowledgment =
      /^(收到|收到啦|好的|好|嗯|嗯嗯|ok|OK|Ok|知道了|明白|行|可以|没问题)[。.!！?？~～…\s]*$/;
    const doneWithoutEvidence = tasks.filter(
      (task) =>
        task.status === "done" &&
        (!task.evidenceQuote?.trim() ||
          acknowledgment.test(task.evidenceQuote.trim())),
    );
    if (doneWithoutEvidence.length > 0) {
      setError(
        `以下任务标记为完成，但完成证据缺失或只是“收到/好的”之类的知悉回复：${doneWithoutEvidence
          .map((task) => `「${task.title}」`)
          .join("、")}。请补充明确的完成原文，或改回待处理。`,
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch(
        `/api/extractions/${encodeURIComponent(extraction.id)}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks,
            risks: risks.map((risk) => ({ ...risk, include: risk.include })),
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { projectId?: string; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.projectId) {
        setError(
          data?.error?.message ??
            `确认失败（HTTP ${response.status}），请稍后重试。`,
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/dashboard/${data.projectId}?created=1`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `网络请求失败：${requestError.message}`
          : "网络请求失败，请检查本地服务。",
      );
    } finally {
      setConfirming(false);
    }
  }

  const selectedRisks = risks.filter((risk) => risk.include).length;
  const needsConfirmation = tasks.filter((task) => task.needsConfirmation).length;
  const risksByTask = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const risk of risks) {
      if (!risk.taskRef) continue;
      map.set(risk.taskRef, (map.get(risk.taskRef) ?? 0) + 1);
    }
    return map;
  }, [risks]);

  const highlights = React.useMemo(() => {
    const items: Array<{ quote: string; taskId: string }> = tasks
      .filter((task) => task.sourceQuote.trim())
      .map((task) => ({ quote: task.sourceQuote, taskId: task.id }));
    for (const risk of risks) {
      if (!risk.taskRef || !risk.sourceQuote) continue;
      for (const part of risk.sourceQuote.split(" / ")) {
        items.push({ quote: part, taskId: risk.taskRef });
      }
    }
    return items;
  }, [risks, tasks]);

  const saveLabel = readOnly
    ? "已确认入库"
    : saveState === "saving"
      ? "正在保存草稿…"
      : saveState === "saved"
        ? "草稿已保存"
        : saveState === "error"
          ? "草稿保存失败"
          : "修改后自动保存草稿";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        projectId={project.id}
        aiConfigured={aiConfigured}
        model={extraction.model ?? undefined}
      />

      <main className="container flex-1 pb-36 pt-7 sm:pt-9">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          返回首页
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">REVIEW / 审核台</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-[32px]">
              确认识别结果
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <Link
                href={`/dashboard/${project.id}`}
                className="font-medium text-ink-soft underline-offset-4 hover:underline"
              >
                {project.name}
              </Link>
              <span className="text-line-strong">/</span>
              <span>{source.kind === "image" ? "聊天截图来源" : "聊天文字来源"}</span>
              <span className="text-line-strong">/</span>
              <span>{tasks.length} 个候选任务</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeBadge mode={extraction.mode} model={extraction.model} />
            {readOnly ? (
              <Badge variant="ok">
                <CheckCircle2 className="h-2.5 w-2.5" />
                已确认
              </Badge>
            ) : (
              <Badge variant="amber">待审核</Badge>
            )}
          </div>
        </div>

        {extraction.mode === "ai" && !readOnly ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-signal-strong/40 bg-signal-soft px-3.5 py-2.5">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-ink" />
            <p className="text-[11px] leading-5 text-signal-ink">
              真实 AI 结果（{extraction.model ?? "deepseek-flash"}）已通过 JSON / Zod
              校验。负责人、日期、完成证据仍须逐项人工确认后才会写入看板。
            </p>
          </div>
        ) : null}

        {readOnly ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok-border bg-ok-soft px-4 py-3">
            <p className="text-[12px] leading-5 text-ok">
              该来源已确认并写入任务库，本页为只读存档。任务状态请到看板更新。
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/${project.id}`}>
                前往任务看板
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-risk-border bg-risk-soft p-3.5"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
            <p className="text-[13px] leading-6 text-risk-strong">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
          <div className="lg:sticky lg:top-24">
            <TranscriptPanel
              sourceId={source.id}
              rawText={source.rawText}
              images={source.images}
              mode={source.mode}
              model={source.model}
              createdAt={source.createdAt}
              highlights={highlights}
              activeTaskId={activeTaskId}
              confirmed={readOnly}
            />
          </div>

          <div className="flex flex-col gap-5">
            <div className="overflow-hidden rounded-2xl bg-ink p-5 text-canvas shadow-lift sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-signal">
                    Parsed summary
                  </p>
                  <p className="mt-2 text-[14px] leading-7 text-canvas/90">
                    {summary}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-canvas/10 border-t border-canvas/10 pt-3.5">
                {[
                  [String(tasks.length).padStart(2, "0"), "任务"],
                  [String(selectedRisks).padStart(2, "0"), "写入风险"],
                  [String(needsConfirmation).padStart(2, "0"), "待核对"],
                ].map(([value, label]) => (
                  <div key={label} className="px-3 first:pl-0 last:pr-0">
                    <p className="font-mono text-lg font-semibold tabular-nums text-canvas">
                      {value}
                    </p>
                    <p className="mt-0.5 text-[10px] text-canvas/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {extraction.warnings.length > 0 ? (
              <details
                open
                className="rounded-xl border border-amber-200 bg-amber-50 p-3.5"
              >
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-amber-900">
                  <AlertTriangle className="h-3 w-3" />
                  解析提示（{extraction.warnings.length}）
                </summary>
                <ul className="mt-2 space-y-1.5 pl-4">
                  {extraction.warnings.map((warning, index) => (
                    <li
                      key={index}
                      className="list-disc text-[11px] leading-5 text-amber-900/80"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow">EXTRACTED TASKS</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                    提取任务
                  </h2>
                </div>
                <p className="text-[10px] text-ink-muted">
                  点击卡片可在左侧原文中定位引用
                </p>
              </div>

              {tasks.length === 0 ? (
                <Card className="border-dashed p-8 text-center">
                  <p className="text-sm text-ink-muted">
                    没有可确认的任务。请返回重新导入对话。
                  </p>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {tasks.map((task, index) => (
                    <TaskEditorCard
                      key={task.id}
                      task={task}
                      index={index}
                      active={task.id === activeTaskId}
                      readOnly={readOnly}
                      riskCount={risksByTask.get(task.id) ?? 0}
                      onChange={(patch) => patchTask(task.id, patch)}
                      onRemove={() => removeTask(task.id)}
                      onActivate={() => setActiveTaskId(task.id)}
                      onLocate={() => locateTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow">RISKS / 待核对风险</p>
                  <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
                    风险与空缺
                    <span className="font-mono text-xs font-normal text-ink-faint">
                      {selectedRisks}/{risks.length}
                    </span>
                  </h2>
                </div>
                <p className="text-[10px] text-ink-muted">
                  取消勾选的风险不会写入；确认后仍可在风险中心修改
                </p>
              </div>

              {risks.length === 0 ? (
                <Card className="flex items-center gap-2.5 border-dashed p-5">
                  <ShieldAlert className="h-4 w-4 text-ink-faint" />
                  <p className="text-[12px] text-ink-muted">
                    本次未发现责任空缺、时间冲突或待核对决策。
                  </p>
                </Card>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {risks.map((risk) => (
                    <RiskEditorCard
                      key={risk.id}
                      risk={risk}
                      taskTitle={
                        tasks.find((task) => task.id === risk.taskRef)?.title ??
                        null
                      }
                      active={
                        Boolean(risk.taskRef) && risk.taskRef === activeTaskId
                      }
                      readOnly={readOnly}
                      onToggle={(next) => toggleRisk(risk.id, next)}
                      onActivate={() => {
                        if (risk.taskRef) locateTask(risk.taskRef);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="container flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
            <span className="font-medium text-ink-soft">
              {tasks.length} 个任务 · {selectedRisks} 条风险
            </span>
            <span className="text-line-strong">·</span>
            <span
              className={cn(
                saveState === "error" ? "text-risk" : undefined,
                saveState === "saved" ? "text-ok" : undefined,
              )}
            >
              {saveLabel}
            </span>
            {!readOnly && needsConfirmation > 0 ? (
              <>
                <span className="text-line-strong">·</span>
                <span>{needsConfirmation} 项待核对</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {readOnly ? (
              <Button asChild variant="signal" size="lg" className="w-full sm:w-auto">
                <Link href={`/dashboard/${project.id}`}>
                  前往任务看板
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => router.push("/")}
                  className="hidden sm:inline-flex"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="signal"
                  size="lg"
                  onClick={confirm}
                  disabled={confirming || tasks.length === 0}
                  className="w-full sm:w-auto"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在写入…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      确认建立任务
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
