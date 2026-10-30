"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileImage,
  FolderKanban,
  ImagePlus,
  Loader2,
  Lock,
  MessageSquareText,
  Quote,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/repo";
import { DEMO_PROJECT_NAME, DEMO_TEXT } from "@/lib/demo";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TEXT_CHARS,
  type ImageInput,
} from "@/lib/schemas";
import { cn, percent, shortDate } from "@/lib/utils";

interface UploadedImage extends ImageInput {
  id: string;
  size: number;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const NON_RETRYABLE = new Set([
  "NEED_API_KEY",
  "EMPTY",
  "TEXT_TOO_LONG",
  "PROJECT_REQUIRED",
  "IMAGE_LIMIT",
  "IMAGE_TYPE",
  "IMAGE_TOO_LARGE",
  "IMAGE_READ",
]);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export function HomeClient({
  projects,
  aiConfigured,
  model,
  initialProjectId,
}: {
  projects: ProjectSummary[];
  aiConfigured: boolean;
  model: string;
  initialProjectId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const initialExisting =
    initialProjectId && projects.some((p) => p.id === initialProjectId)
      ? initialProjectId
      : "";
  const [projectMode, setProjectMode] = React.useState<"new" | "existing">(
    initialExisting ? "existing" : "new",
  );
  const [existingId, setExistingId] = React.useState(initialExisting);
  const [projectName, setProjectName] = React.useState("");
  const [tab, setTab] = React.useState<"text" | "image">("text");
  const [text, setText] = React.useState("");
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<{
    code?: string;
    message: string;
  } | null>(null);

  const totalImageBytes = images.reduce((sum, image) => sum + image.size, 0);

  React.useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const loadingStage =
    elapsed < 4
      ? "正在读取对话结构"
      : elapsed < 12
        ? "正在抽取任务、负责人与截止时间"
        : "正在校验 JSON、来源引用与风险";

  const addFiles = React.useCallback(
    async (files: File[]) => {
      setError(null);
      if (!aiConfigured) {
        setError({
          code: "NEED_API_KEY",
          message:
            "截图理解需要服务端 DEEPSEEK_API_KEY，当前未配置。请粘贴聊天文字使用示例解析，或配置密钥后重启服务。",
        });
        return;
      }

      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        setError({
          code: "IMAGE_LIMIT",
          message: `最多上传 ${MAX_IMAGES} 张截图。`,
        });
        return;
      }

      const accepted: UploadedImage[] = [];
      for (const file of files.slice(0, remaining)) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          setError({
            code: "IMAGE_TYPE",
            message: `「${file.name}」格式不支持。仅接受 JPEG / PNG / WebP。`,
          });
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setError({
            code: "IMAGE_TOO_LARGE",
            message: `「${file.name}」超过 5 MB 上限。`,
          });
          continue;
        }
        try {
          const dataUrl = await readAsDataUrl(file);
          accepted.push({
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            mime: file.type as ImageInput["mime"],
            size: file.size,
            dataUrl,
          });
        } catch {
          setError({ code: "IMAGE_READ", message: `无法读取「${file.name}」。` });
        }
      }

      if (files.length > remaining) {
        setError({
          code: "IMAGE_LIMIT",
          message: `最多上传 ${MAX_IMAGES} 张截图，已保留前 ${remaining} 张。`,
        });
      }
      if (accepted.length > 0) {
        setImages((current) => [...current, ...accepted].slice(0, MAX_IMAGES));
      }
    },
    [aiConfigured, images.length],
  );

  function removeImage(id: string) {
    setImages((current) => current.filter((image) => image.id !== id));
  }

  function openScreenshot() {
    if (!aiConfigured) {
      setError({
        code: "NEED_API_KEY",
        message:
          "截图理解需要服务端 DEEPSEEK_API_KEY。当前服务端未配置密钥，请先配置并重启，或使用示例文字流程。",
      });
      return;
    }
    setError(null);
    setTab("image");
    window.setTimeout(() => {
      document
        .getElementById("import-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function loadSample() {
    setText(DEMO_TEXT);
    setProjectName(DEMO_PROJECT_NAME);
    setProjectMode("new");
    setExistingId("");
    setTab("text");
    setError(null);
    toast({
      title: "示例对话已加载",
      description: "点「开始解析」后会走审核流程，不会直接写入看板。",
      tone: "info",
    });
    window.setTimeout(() => {
      document
        .getElementById("import-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const trimmed = text.trim();
    if (!trimmed && images.length === 0) {
      setError({ code: "EMPTY", message: "请粘贴聊天文字，或上传至少一张截图。" });
      return;
    }
    if (trimmed.length > MAX_TEXT_CHARS) {
      setError({
        code: "TEXT_TOO_LONG",
        message: `文字超过 ${MAX_TEXT_CHARS} 字上限，请精简后重试。`,
      });
      return;
    }
    if (projectMode === "existing" && !existingId) {
      setError({ code: "PROJECT_REQUIRED", message: "请选择一个已有项目。" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectMode === "existing" ? existingId : null,
          projectName:
            projectMode === "new" ? projectName.trim() || null : null,
          text: trimmed,
          images: images.map(({ name, mime, dataUrl }) => ({
            name,
            mime,
            dataUrl,
          })),
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { extractionId?: string; error?: { code?: string; message?: string } }
        | null;

      if (!response.ok || !data?.extractionId) {
        setError({
          code: data?.error?.code,
          message:
            data?.error?.message ??
            `解析请求失败（HTTP ${response.status}），请稍后重试。`,
        });
        return;
      }

      router.push(`/review/${data.extractionId}`);
    } catch (requestError) {
      setError({
        code: "NETWORK",
        message:
          requestError instanceof Error
            ? `网络请求失败：${requestError.message}`
            : "网络请求失败，请检查本地服务是否运行。",
      });
    } finally {
      setLoading(false);
    }
  }

  const selectedProject = projects.find((p) => p.id === existingId);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        projectId={initialExisting || projects[0]?.id}
        active="home"
        aiConfigured={aiConfigured}
        model={model}
      />

      <main className="container flex-1 pb-20 pt-10 sm:pt-14">
        <section className="grid items-end gap-10 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="animate-fade-up">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-signal-strong" />
              <span className="eyebrow">CHAT → REVIEW → ACTION</span>
            </div>
            <h1 className="mt-5 text-balance text-[42px] font-semibold leading-[1.03] tracking-[-0.04em] text-ink sm:text-[60px]">
              聊天结束的地方，
              <br />
              工作
              <span className="relative mx-0.5 inline-block">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-[0.08em] -z-10 h-[0.36em] bg-signal"
                />
                开始
              </span>
              。
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-muted">
              FlowBack 把聊天文字和截图变成
              <span className="font-medium text-ink-soft">可审核、可执行、可追溯</span>
              的任务看板。责任空缺、时间冲突、未确认决策，在开工之前一次说清。
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {[
                ["责任空缺", ShieldAlert],
                ["时间冲突", Clock3],
                ["未确认事项", AlertCircle],
                ["原文可追溯", Quote],
                ["截图理解", ImagePlus],
              ].map(([label, Icon]) => {
                const IconComponent = Icon as React.ComponentType<{
                  className?: string;
                }>;
                return (
                  <span
                    key={label as string}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft"
                  >
                    <IconComponent className="h-3 w-3 text-ink-muted" />
                    {label as string}
                  </span>
                );
              })}
            </div>
          </div>

          <HeroPreview />
        </section>

        <section className="mt-10 grid items-start gap-6 lg:mt-14 lg:grid-cols-[minmax(0,1.38fr)_minmax(0,0.62fr)]">
          <form
            id="import-form"
            onSubmit={submit}
            className="animate-fade-up scroll-mt-24"
            style={{ animationDelay: "80ms" }}
          >
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                <div>
                  <p className="eyebrow">IMPORT / 导入</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
                    导入一段对话
                  </h2>
                  <p className="mt-1.5 max-w-lg text-[13px] leading-6 text-ink-muted">
                    粘贴聊天文字，或上传聊天截图，DeepSeek 会直接读取截图。提取结果先进入审核台，由你确认后才写入任务库。
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={openScreenshot}
                    disabled={!aiConfigured}
                    title={
                      aiConfigured
                        ? "上传聊天截图，使用 DeepSeek 图片理解"
                        : "配置 DEEPSEEK_API_KEY 后可用"
                    }
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    上传截图
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadSample}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    加载示例
                  </Button>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div
                  className="mb-4 inline-flex rounded-xl border border-line bg-canvas p-1"
                  role="tablist"
                  aria-label="输入方式"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "text"}
                    onClick={() => setTab("text")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      tab === "text"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    聊天文字
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === "image"}
                    onClick={() => setTab("image")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      tab === "image"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    聊天截图
                    {!aiConfigured ? (
                      <Lock className="h-2.5 w-2.5 text-ink-faint" />
                    ) : null}
                  </button>
                </div>

                {tab === "text" ? (
                  <div className="animate-fade-in">
                    <Textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={9}
                      maxLength={MAX_TEXT_CHARS}
                      placeholder={`把聊天记录原样粘贴进来，例如：\n\n林悦 10/12 14:03\n这周把发布会物料定下来吧。海报先让小王负责，周五提交初稿。\n小王 10/12 14:10\n收到\n林悦 10/12 15:22\n海报的最终稿改成周四交，我要提前给老板看。`}
                      aria-label="聊天文字"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-2xs text-ink-faint">
                        保留说话人与时间戳，识别会更准。
                      </p>
                      <span
                        className={cn(
                          "font-mono text-[10px] tabular-nums",
                          text.length > MAX_TEXT_CHARS
                            ? "text-risk"
                            : "text-ink-faint",
                        )}
                      >
                        {text.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    {!aiConfigured ? (
                      <div className="rounded-xl border border-dashed border-risk-border bg-risk-soft/60 p-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-risk-border bg-surface">
                            <Lock className="h-4 w-4 text-risk" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              截图理解当前不可用
                            </p>
                            <p className="mt-1 text-[13px] leading-6 text-ink-muted">
                              服务端未配置{" "}
                              <code className="rounded bg-ink/[0.06] px-1 py-0.5 font-mono text-[11px]">
                                DEEPSEEK_API_KEY
                              </code>
                              。截图需要真实图片理解，示例模式不会伪造 OCR 结果。
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={() => setTab("text")}
                            >
                              <MessageSquareText className="h-3.5 w-3.5" />
                              改为粘贴文字
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {images.length > 0 ? (
                          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {images.map((image) => (
                              <div
                                key={image.id}
                                className="group relative overflow-hidden rounded-xl border border-line bg-canvas"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={image.dataUrl}
                                  alt={image.name}
                                  className="aspect-[4/3] w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(image.id)}
                                  className="absolute right-1.5 top-1.5 rounded-full bg-ink/80 p-1 text-canvas opacity-90 transition-opacity hover:bg-ink"
                                  aria-label={`移除 ${image.name}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                <div className="truncate px-2 py-1.5 text-[10px] text-ink-muted">
                                  {image.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {images.length < MAX_IMAGES ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => fileRef.current?.click()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                fileRef.current?.click();
                              }
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(event) => {
                              event.preventDefault();
                              setDragging(false);
                              void addFiles(Array.from(event.dataTransfer.files));
                            }}
                            className={cn(
                              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                              dragging
                                ? "border-signal-strong bg-signal-soft/60"
                                : "border-line-strong bg-canvas/60 hover:border-ink/30 hover:bg-canvas",
                            )}
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface">
                              <UploadCloud className="h-4 w-4 text-ink-soft" />
                            </span>
                            <p className="mt-3 text-sm font-medium text-ink">
                              拖拽截图到这里，或点击选择
                            </p>
                            <p className="mt-1 text-xs text-ink-muted">
                              JPEG / PNG / WebP · 单张 ≤ 5 MB · 最多 {MAX_IMAGES} 张
                            </p>
                          </div>
                        ) : null}

                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="sr-only"
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            void addFiles(files);
                            event.target.value = "";
                          }}
                        />

                        {images.length > 0 ? (
                          <div className="mt-2 flex items-center justify-between text-2xs text-ink-faint">
                            <span className="inline-flex items-center gap-1">
                              <FileImage className="h-3 w-3" />
                              {images.length} 张截图 ·{" "}
                              {(totalImageBytes / 1024 / 1024).toFixed(2)} MB
                            </span>
                            <span>图片仅在本机保存与服务端调用</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <p className="field-label">导入到项目</p>
                    {projects.length > 0 ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setProjectMode("new")}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                            projectMode === "new"
                              ? "border-ink bg-ink text-canvas"
                              : "border-line bg-surface text-ink-muted hover:text-ink",
                          )}
                        >
                          新建项目
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectMode("existing")}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors",
                            projectMode === "existing"
                              ? "border-ink bg-ink text-canvas"
                              : "border-line bg-surface text-ink-muted hover:text-ink",
                          )}
                        >
                          已有项目
                        </button>
                      </div>
                    ) : null}

                    {projectMode === "new" ? (
                      <Input
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        maxLength={60}
                        placeholder={`可选，默认按对话内容命名`}
                        aria-label="新项目名称"
                      />
                    ) : (
                      <Select
                        value={existingId}
                        onChange={(event) => setExistingId(event.target.value)}
                        aria-label="选择已有项目"
                      >
                        <option value="">选择一个项目…</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}（{project.taskCount} 任务）
                          </option>
                        ))}
                      </Select>
                    )}
                    <p className="mt-1.5 text-2xs text-ink-faint">
                      {projectMode === "existing" && selectedProject
                        ? `将追加到「${selectedProject.name}」的任务看板。`
                        : "同一项目的任务会汇总到同一个看板。"}
                    </p>
                  </div>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-risk-border bg-risk-soft p-3.5"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-6 text-risk-strong">
                          {error.message}
                        </p>
                        {error.code ? (
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-risk/70">
                            {error.code}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {error.code && !NON_RETRYABLE.has(error.code) ? (
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className="shrink-0 border-risk-border bg-surface text-risk-strong hover:bg-surface"
                      >
                        重试
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-2xs text-ink-muted">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        aiConfigured ? "bg-ok" : "bg-risk",
                      )}
                    />
                    {aiConfigured
                      ? `DeepSeek ${model} · 服务端调用 · 密钥不下发浏览器`
                      : "示例模式 · 本地规则解析，不会伪装成 AI 结果"}
                  </div>
                  <Button
                    type="submit"
                    variant="signal"
                    size="lg"
                    disabled={
                      loading ||
                      (tab === "image" && !aiConfigured) ||
                      (!text.trim() && images.length === 0)
                    }
                    className="min-w-[168px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        正在解析…
                      </>
                    ) : (
                      <>
                        {aiConfigured ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        {aiConfigured ? "开始 AI 解析" : "运行示例解析"}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
                {loading ? (
                  <p
                    aria-live="polite"
                    className="mt-2 flex items-center justify-end gap-1.5 text-2xs text-ink-faint"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal-strong" />
                    {aiConfigured
                      ? `${loadingStage} · 已等待 ${elapsed}s · 失败可重试，请勿关闭页面`
                      : "正在运行本地规则解析…"}
                  </p>
                ) : null}
              </div>
            </Card>
          </form>

          <aside
            className="flex flex-col gap-5 animate-fade-up"
            style={{ animationDelay: "140ms" }}
          >
            <Card>
              <div className="flex items-center justify-between border-b border-line p-4">
                <div>
                  <p className="eyebrow">PROJECTS</p>
                  <h3 className="mt-1 text-sm font-semibold text-ink">项目入口</h3>
                </div>
                <FolderKanban className="h-4 w-4 text-ink-faint" />
              </div>
              {projects.length === 0 ? (
                <div className="p-4">
                  <p className="rounded-xl border border-dashed border-line-strong bg-canvas/60 p-4 text-[13px] leading-6 text-ink-muted">
                    还没有项目。导入一段对话或加载示例，FlowBack 会创建第一个项目。
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {projects.slice(0, 5).map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/dashboard/${project.id}`}
                        className="group flex items-center gap-3 p-4 transition-colors hover:bg-canvas/70"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-[11px] font-semibold text-signal">
                          {project.name.slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium text-ink">
                              {project.name}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] text-ink-faint">
                              {shortDate(project.updatedAt)}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                            {project.taskCount} 任务
                            <span className="text-line-strong">/</span>
                            {project.doneCount} 完成
                            {project.openRiskCount > 0 ? (
                              <>
                                <span className="text-line-strong">/</span>
                                <span className="text-risk">
                                  {project.openRiskCount} 风险
                                </span>
                              </>
                            ) : null}
                          </span>
                          <Progress
                            value={percent(project.doneCount, project.taskCount)}
                            className="mt-2 h-1"
                          />
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="overflow-hidden rounded-2xl bg-ink p-5 shadow-lift sm:p-6">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-signal" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
                  Demo case / 示例
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-canvas">
                秋季品牌发布会
              </h3>
              <p className="mt-1 text-[12px] leading-6 text-canvas/55">
                一段 6 条消息的群聊，包含四个典型陷阱。
              </p>
              <ul className="mt-4 space-y-2.5">
                {[
                  "海报初稿周五 vs 最终稿周四",
                  "联系场地方，没有人被指派",
                  "“收到”不是完成证据",
                  "舞台设计负责人明确",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[12px] leading-5 text-canvas/80"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 bg-signal" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="signal"
                className="mt-5 w-full"
                onClick={loadSample}
              >
                <Wand2 className="h-4 w-4" />
                加载示例对话
              </Button>
              <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-canvas/35">
                有 Key 时走真实 AI；无 Key 时明确标记示例模式
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-surface/60 p-4">
              <p className="eyebrow">HOW IT WORKS</p>
              <ol className="mt-3 space-y-3">
                {[
                  ["01", "导入", "聊天文字或截图，保留原始上下文。"],
                  ["02", "审核", "逐项修改负责人、截止时间与风险。"],
                  ["03", "执行", "确认入库，在看板推进并留痕。"],
                ].map(([num, title, desc]) => (
                  <li key={num} className="flex items-start gap-3">
                    <span className="font-mono text-[10px] text-ink-faint">{num}</span>
                    <div>
                      <p className="text-xs font-semibold text-ink">{title}</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-ink-muted">
                        {desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function HeroPreview() {
  return (
    <div
      className="relative animate-fade-up rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
      style={{ animationDelay: "120ms" }}
      aria-label="产品预览"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-strong" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
            Review preview
          </span>
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-faint">
          只读预览
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-canvas/70 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[9px] font-semibold text-signal">
            林
          </span>
          <span className="text-[11px] font-medium text-ink">林悦</span>
          <span className="font-mono text-[9px] text-ink-faint">15:22</span>
        </div>
        <p className="mt-2 text-[12px] leading-5 text-ink-soft">
          海报的最终稿改成周四交，我要提前给老板看。
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded bg-signal px-1.5 py-0.5 text-[9px] font-medium text-signal-ink">
            原文引用
          </span>
          <span className="text-[9px] text-ink-faint">已定位到消息</span>
        </div>
      </div>

      <div className="my-2 flex items-center gap-2 pl-4">
        <span className="h-6 w-px bg-line-strong" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal">
          <Sparkles className="h-2.5 w-2.5 text-signal-ink" />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          解析为
        </span>
      </div>

      <div className="rounded-xl border border-ink/[0.08] bg-surface p-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-ink">
              海报最终稿
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              负责人 <span className="font-medium text-ink-soft">小王</span> ·
              截止 <span className="font-medium text-ink-soft">周四</span>
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-risk-border bg-risk-soft px-2 py-0.5 text-[9px] font-medium text-risk-strong">
            时间冲突
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[9px] text-ok">
            <CheckCircle2 className="h-2.5 w-2.5" />
            海报初稿已完成
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-risk-soft px-2 py-0.5 text-[9px] text-risk-strong">
            <Clock3 className="h-2.5 w-2.5" />
            初稿周五 → 最终稿周四
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-canvas/50">
        {[
          ["04", "任务"],
          ["04", "风险"],
          ["01", "已完成"],
        ].map(([value, label]) => (
          <div key={label} className="px-2 py-2 text-center">
            <p className="font-mono text-sm font-semibold tabular-nums text-ink">
              {value}
            </p>
            <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faint">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
