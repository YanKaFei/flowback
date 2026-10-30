"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Quote, ScanText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ModeBadge } from "@/components/badges";
import type { AnalysisMode } from "@/lib/schemas";
import { cn, shortDate } from "@/lib/utils";

export interface TranscriptMessage {
  speaker: string | null;
  time: string | null;
  text: string;
}

const HEADER_RE =
  /^([\u4e00-\u9fa5A-Za-z0-9_\-]{1,20})\s+((?:\d{1,2}\/\d{1,2}\s+)?\d{1,2}:\d{2})$/;
const INLINE_RE = /^([\u4e00-\u9fa5]{2,4})[:：]\s*(.+)$/;

export function parseTranscript(raw: string): {
  title: string | null;
  messages: TranscriptMessage[];
} {
  const lines = raw.split(/\r?\n/);
  const messages: TranscriptMessage[] = [];
  let title: string | null = null;
  let current: TranscriptMessage | null = null;

  function flush() {
    if (current && current.text.trim()) {
      messages.push({ ...current, text: current.text.trim() });
    }
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = HEADER_RE.exec(line);
    if (header) {
      flush();
      current = { speaker: header[1], time: header[2], text: "" };
      continue;
    }

    const inline = INLINE_RE.exec(line);
    if (inline) {
      flush();
      messages.push({ speaker: inline[1], time: null, text: inline[2] });
      continue;
    }

    if (current) {
      current.text = current.text ? `${current.text}\n${line}` : line;
    } else if (!title && messages.length === 0) {
      title = line;
    } else {
      current = { speaker: null, time: null, text: line };
    }
  }
  flush();

  return { title, messages };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightedText({
  text,
  highlights,
  activeTaskId,
}: {
  text: string;
  highlights: Array<{ quote: string; taskId: string }>;
  activeTaskId: string | null;
}) {
  const relevant = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of highlights) {
      const quote = item.quote?.trim();
      if (!quote || quote.length < 2) continue;
      if (!text.includes(quote)) continue;
      if (!map.has(quote)) map.set(quote, item.taskId);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].length - a[0].length);
  }, [highlights, text]);

  if (relevant.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink-soft">
        {text}
      </p>
    );
  }

  const pattern = new RegExp(
    `(${relevant.map(([quote]) => escapeRegExp(quote)).join("|")})`,
    "g",
  );
  const parts = text.split(pattern);

  return (
    <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink-soft">
      {parts.map((part, index) => {
        const hit = relevant.find(([quote]) => quote === part);
        if (!hit) return <React.Fragment key={index}>{part}</React.Fragment>;
        const [quote, taskId] = hit;
        const active = taskId === activeTaskId;
        return (
          <mark
            key={index}
            id={`quote-${taskId}`}
            data-quote={quote}
            className={cn(
              "scroll-mt-28 rounded-[3px] px-0.5 text-ink transition-colors duration-300",
              active
                ? "bg-signal ring-1 ring-signal-strong"
                : "bg-signal-soft/80 decoration-signal-strong/50 underline-offset-2",
            )}
          >
            {part}
          </mark>
        );
      })}
    </p>
  );
}

export function TranscriptPanel({
  sourceId,
  rawText,
  images,
  mode,
  model,
  createdAt,
  highlights,
  activeTaskId,
  confirmed,
}: {
  sourceId: string;
  rawText: string;
  images: Array<{ name: string; mime: string }>;
  mode: AnalysisMode;
  model: string | null;
  createdAt: string;
  highlights: Array<{ quote: string; taskId: string }>;
  activeTaskId: string | null;
  confirmed: boolean;
}) {
  const parsed = React.useMemo(() => parseTranscript(rawText), [rawText]);
  const quoteCount = highlights.filter((h) => h.quote.trim().length > 1).length;

  return (
    <Card className="flex flex-col overflow-hidden" id="transcript">
      <div className="border-b border-line p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">SOURCE / 原文</p>
            <h2 className="mt-1.5 text-base font-semibold tracking-tight text-ink">
              {parsed.title ?? "原始对话"}
            </h2>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1">
            {images.length > 0 ? (
              <>
                <ImageIcon className="h-3 w-3" />
                截图{rawText.trim() ? " + 文字" : ""}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                文字
              </>
            )}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
          <ModeBadge mode={mode} model={model} className="mr-1" />
          <span>{shortDate(createdAt)} 导入</span>
          {!confirmed ? (
            <>
              <span className="text-line-strong">·</span>
              <span>引用已逐字定位</span>
            </>
          ) : null}
        </div>
      </div>

      {mode === "demo" ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] leading-5 text-amber-900 sm:px-5">
          示例模式：本页结果由本地规则引擎生成，不是 DeepSeek
          输出，仅用于演示审核流程。
        </div>
      ) : null}

      <div className="max-h-[340px] flex-1 overflow-y-auto lg:max-h-[calc(100vh-24rem)]">
        {images.length > 0 ? (
          <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 sm:p-5">
            {images.map((image, index) => {
              const url = `/api/sources/${sourceId}/image/${index}`;
              return (
                <a
                  key={`${image.name}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-xl border border-line bg-canvas"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={image.name}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-2 py-1 text-[10px] text-canvas">
                    {image.name}
                  </span>
                </a>
              );
            })}
          </div>
        ) : null}

        {parsed.messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <ScanText className="h-5 w-5 text-ink-faint" />
            <p className="text-[13px] text-ink-muted">
              {images.length > 0
                ? "这是截图来源，原文引用请对照上方截图核对。"
                : "没有可展示的对话内容。"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line/70">
            {parsed.messages.map((message, index) => (
              <div key={index} className="flex gap-3 px-4 py-3.5 sm:px-5">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    message.speaker
                      ? "bg-ink/[0.07] text-ink-soft"
                      : "border border-dashed border-line-strong text-ink-faint",
                  )}
                >
                  {message.speaker ? message.speaker.slice(0, 1) : "·"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[12px] font-medium text-ink">
                      {message.speaker ?? "原文"}
                    </span>
                    {message.time ? (
                      <span className="font-mono text-[9px] text-ink-faint">
                        {message.time}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    <HighlightedText
                      text={message.text}
                      highlights={highlights}
                      activeTaskId={activeTaskId}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-canvas/60 px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Quote className="h-3 w-3 text-ink-faint" />
          {quoteCount} 条原文引用
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          Read-only source
        </span>
      </div>
    </Card>
  );
}
