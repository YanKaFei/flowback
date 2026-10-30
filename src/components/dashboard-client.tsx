"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  ListChecks,
  Plus,
  ShieldAlert,
  Timer,
  TriangleAlert,
} from "lucide-react";
import type { ProjectBundle, TaskRecord } from "@/lib/repo";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ModeBadge } from "@/components/badges";
import { BoardTaskCard } from "@/components/dashboard/task-card";
import { TaskDialog } from "@/components/dashboard/task-dialog";
import { useToast } from "@/components/ui/toast";
import { cn, percent, shortDate } from "@/lib/utils";

const COLUMNS = [
  {
    key: "todo" as const,
    label: "待处理",
    hint: "等待开始",
    dot: "bg-ink-faint",
    empty: "待处理任务会出现在这里",
  },
  {
    key: "doing" as const,
    label: "进行中",
    hint: "正在推进",
    dot: "bg-info",
    empty: "开始推进后，任务会移到这里",
  },
  {
    key: "done" as const,
    label: "已完成",
    hint: "已交付",
    dot: "bg-ok",
    empty: "完成的交付会归档在这里",
  },
];

export function DashboardClient({
  bundle,
  aiConfigured,
  model,
  created,
}: {
  bundle: ProjectBundle;
  aiConfigured: boolean;
  model: string;
  created: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = React.useState<TaskRecord[]>(bundle.tasks);
  const [risks, setRisks] = React.useState(bundle.risks);
  const [events, setEvents] = React.useState(bundle.events);
  const [selectedTask, setSelectedTask] = React.useState<TaskRecord | null>(
    null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const shownCreated = React.useRef(false);

  React.useEffect(() => {
    setTasks(bundle.tasks);
    setRisks(bundle.risks);
    setEvents(bundle.events);
  }, [bundle]);

  React.useEffect(() => {
    if (!created || shownCreated.current) return;
    shownCreated.current = true;
    toast({
      title: "任务已建立",
      description: "审核结果已写入本地看板，刷新页面不会丢失。",
      tone: "success",
    });
    router.replace(`/dashboard/${bundle.project.id}`);
  }, [bundle.project.id, created, router, toast]);

  const doneCount = tasks.filter((task) => task.status === "done").length;
  const doingCount = tasks.filter((task) => task.status === "doing").length;
  const todoCount = tasks.filter((task) => task.status === "todo").length;
  const completion = percent(doneCount, tasks.length);
  const openRisks = risks.filter((risk) => risk.status !== "resolved");
  const ownerGapCount = openRisks.filter((risk) => risk.type === "owner_gap").length;
  const timeIssueCount = openRisks.filter(
    (risk) => risk.type === "due_conflict" || risk.type === "due_unclear",
  ).length;
  const pendingConfirmation = tasks.filter(
    (task) => task.needsConfirmation && task.status !== "done",
  ).length;

  async function changeStatus(
    task: TaskRecord,
    next: TaskRecord["status"],
  ) {
    if (busyId || task.status === next) return;
    const snapshot = tasks;
    setBusyId(task.id);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, status: next, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json().catch(() => null)) as
        | { task?: TaskRecord; error?: { message?: string } }
        | null;
      if (!response.ok || !data?.task) {
        throw new Error(data?.error?.message ?? "状态更新失败");
      }
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? data.task! : item)),
      );
      toast({
        title:
          next === "done"
            ? "任务已完成"
            : next === "doing"
              ? "任务已开始"
              : "任务已重新打开",
        description: "状态已保存到本地数据库。",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setTasks(snapshot);
      toast({
        title: "状态更新失败",
        description: error instanceof Error ? error.message : "请稍后重试。",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(updated: TaskRecord) {
    setTasks((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    router.refresh();
  }

  const extractionsBySource = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const extraction of bundle.extractions) {
      if (!map.has(extraction.sourceId)) {
        map.set(extraction.sourceId, extraction.id);
      }
    }
    return map;
  }, [bundle.extractions]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        projectId={bundle.project.id}
        active="dashboard"
        aiConfigured={aiConfigured}
        model={model}
      />

      <main className="container flex-1 pb-20 pt-8 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">PROJECT / 任务看板</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-ink sm:text-[36px]">
              {bundle.project.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <span>创建于 {shortDate(bundle.project.createdAt)}</span>
              <span className="text-line-strong">/</span>
              <span>{bundle.project.sourceCount} 条来源</span>
              <span className="text-line-strong">/</span>
              <span>{tasks.length} 个任务</span>
              <span className="text-line-strong">/</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                本地 SQLite 持久化
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/risks/${bundle.project.id}`}>
                <ShieldAlert className="h-4 w-4" />
                风险中心
                {openRisks.length > 0 ? (
                  <span className="rounded-full bg-risk px-1.5 py-0.5 font-mono text-[9px] text-white">
                    {openRisks.length}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild variant="signal">
              <Link href={`/?project=${bundle.project.id}`}>
                <Plus className="h-4 w-4" />
                导入新对话
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="TOTAL TASKS"
            title="总任务"
            value={String(tasks.length).padStart(2, "0")}
            sub={`待处理 ${todoCount} · 进行中 ${doingCount}`}
            icon={ListChecks}
          />
          <div className="rounded-2xl bg-ink p-4 text-canvas shadow-lift">
            <div className="flex items-start justify-between">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-canvas/45">
                COMPLETION
              </p>
              <CheckCircle2 className="h-4 w-4 text-signal" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-canvas">
                {completion}
              </span>
              <span className="text-sm text-canvas/50">%</span>
            </div>
            <Progress
              value={completion}
              className="mt-3 bg-canvas/15"
              barClassName="bg-signal"
            />
            <p className="mt-2 text-[10px] text-canvas/50">
              {doneCount} / {tasks.length} 个任务已完成
            </p>
          </div>
          <StatCard
            label="IN PROGRESS"
            title="进行中"
            value={String(doingCount).padStart(2, "0")}
            sub={
              pendingConfirmation > 0
                ? `${pendingConfirmation} 个任务待核对字段`
                : "所有任务字段已核对"
            }
            icon={Timer}
            tone={pendingConfirmation > 0 ? "amber" : "default"}
          />
          <StatCard
            label="OPEN RISKS"
            title="待核对风险"
            value={String(openRisks.length).padStart(2, "0")}
            sub={`无人负责 ${ownerGapCount} · 时间问题 ${timeIssueCount}`}
            icon={ShieldAlert}
            tone={openRisks.length > 0 ? "risk" : "ok"}
          />
        </section>

        {openRisks.length > 0 ? (
          <Link
            href={`/risks/${bundle.project.id}`}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-risk-border bg-risk-soft px-4 py-3 transition-colors hover:bg-risk-soft/80"
          >
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
              <p className="text-[12px] leading-5 text-risk-strong">
                有 <span className="font-semibold">{openRisks.length}</span>{" "}
                项待核对风险未解决
                <span className="ml-2 text-risk/70">
                  其中 {ownerGapCount} 项无人负责，{timeIssueCount} 项时间问题
                </span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-risk">
              去处理
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ) : risks.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-ok-border bg-ok-soft px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-ok" />
            <p className="text-[12px] text-ok">
              所有风险均已处理，当前没有待核对项。
            </p>
          </div>
        ) : null}

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">BOARD</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                任务看板
              </h2>
            </div>
            <p className="text-[10px] text-ink-muted">
              点击卡片编辑 · 状态变更即时保存 · 记录事件
            </p>
          </div>

          {tasks.length === 0 ? (
            <Card className="border-dashed p-10 text-center sm:p-14">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-canvas">
                <FolderKanban className="h-5 w-5 text-ink-muted" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">
                还没有任务
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-ink-muted">
                从一段聊天开始。FlowBack 会先给出可审核的提取结果，确认后才写入这块看板。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button asChild variant="signal">
                  <Link href={`/?project=${bundle.project.id}`}>
                    <Plus className="h-4 w-4" />
                    导入第一段对话
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/">
                    <CircleDashed className="h-4 w-4" />
                    加载示例
                  </Link>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {COLUMNS.map((column) => {
                const columnTasks = tasks.filter(
                  (task) => task.status === column.key,
                );
                return (
                  <div
                    key={column.key}
                    className="flex flex-col rounded-2xl border border-line bg-canvas/60"
                  >
                    <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", column.dot)}
                        />
                        <h3 className="text-[12px] font-semibold text-ink">
                          {column.label}
                        </h3>
                        <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                          {columnTasks.length}
                        </span>
                      </div>
                      <span className="text-[9px] text-ink-faint">
                        {column.hint}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-2.5 p-2.5">
                      {columnTasks.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-10 text-center">
                          <p className="text-[10px] leading-5 text-ink-faint">
                            {column.empty}
                          </p>
                        </div>
                      ) : (
                        columnTasks.map((task) => (
                          <BoardTaskCard
                            key={task.id}
                            task={task}
                            riskCount={
                              risks.filter(
                                (risk) =>
                                  risk.taskId === task.id &&
                                  risk.status !== "resolved",
                              ).length
                            }
                            onOpen={() => setSelectedTask(task)}
                            onStatus={(next) => void changeStatus(task, next)}
                            busy={busyId === task.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {bundle.sources.length > 0 ? (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <p className="eyebrow">SOURCES / 来源</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  每张任务卡都能回到原文
                </h2>
              </div>
              <span className="text-[10px] text-ink-muted">
                {bundle.sources.length} 条来源
              </span>
            </div>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {bundle.sources.map((source) => {
                  const extractionId = extractionsBySource.get(source.id);
                  const preview =
                    source.rawText
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                      .join(" · ") ||
                    source.fileNames.join("、") ||
                    "截图来源";
                  return (
                    <li
                      key={source.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas">
                          {source.kind === "text" ? (
                            <FileText className="h-3.5 w-3.5 text-ink-muted" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5 text-ink-muted" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-medium text-ink">
                              {source.kind === "text"
                                ? "聊天文字"
                                : source.kind === "mixed"
                                  ? "文字 + 截图"
                                  : "聊天截图"}
                            </span>
                            <ModeBadge mode={source.mode} />
                            <span className="font-mono text-[9px] text-ink-faint">
                              {shortDate(source.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 max-w-2xl truncate text-[11px] text-ink-muted">
                            {preview}
                          </p>
                        </div>
                      </div>
                      {extractionId ? (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/review/${extractionId}`}>
                            查看审核存档
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ) : null}
      </main>

      <SiteFooter />

      <TaskDialog
        task={selectedTask}
        risks={risks}
        events={events}
        onClose={() => setSelectedTask(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function StatCard({
  label,
  title,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "risk" | "amber" | "ok";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
          {label}
        </p>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "risk"
              ? "text-risk"
              : tone === "amber"
                ? "text-amber-600"
                : tone === "ok"
                  ? "text-ok"
                  : "text-ink-faint",
          )}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </span>
        <span className="text-[11px] text-ink-muted">{title}</span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-muted">
        <Clock3 className="h-2.5 w-2.5 text-ink-faint" />
        {sub}
      </p>
    </div>
  );
}
