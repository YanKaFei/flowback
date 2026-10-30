import type { AiExtraction } from "./schemas";

/**
 * Built-in demo transcript. It is deliberately small but contains every
 * acceptance-critical pattern:
 *  - 海报初稿 due 周五 vs 最终稿 due 周四  -> due conflict
 *  - 联系场地方 has no owner              -> owner gap
 *  - 联系场地方 has no date               -> unclear deadline
 *  - “收到” is only an acknowledgement    -> never completion
 *  - “海报初稿已经发到你邮箱了”            -> real completion evidence
 *  - “物料定下来” is a vague decision      -> decision to verify
 */
export const DEMO_PROJECT_NAME = "秋季品牌发布会";

export const DEMO_TEXT = `秋季品牌发布会 · 项目群
林悦 10/12 14:03
这周把发布会物料定下来吧。海报先让小王负责，周五提交初稿。
小王 10/12 14:10
收到
林悦 10/12 15:22
海报的最终稿改成周四交，我要提前给老板看。
陈默 10/12 16:05
场地那边还得有人联系场地方，确认舞台尺寸和入场时间。
林悦 10/12 16:30
舞台设计这块我来负责，周三前给方案。
小王 10/12 17:02
海报初稿已经发到你邮箱了，先按这个方向。`;

export const DEMO_SUMMARY =
  "识别 4 项任务：海报最终稿、海报初稿、舞台设计、场地联系。海报存在两个不同截止时间；场地联系无人负责且没有日期；“物料”范围尚未确认。";

/** Wire-format demo extraction, normalised by the same pipeline as real AI. */
export function buildDemoExtraction(): AiExtraction {
  return {
    project_name: DEMO_PROJECT_NAME,
    transcript: null,
    summary: DEMO_SUMMARY,
    tasks: [
      {
        title: "海报最终稿",
        owner: "小王",
        due_label: "周四",
        due_date: null,
        priority: "high",
        status: "todo",
        confidence: "explicit",
        source_quote: "海报的最终稿改成周四交，我要提前给老板看。",
        speaker: "林悦",
        evidence_quote: null,
        needs_confirmation: true,
        note: "最终稿周四早于初稿周五，需确认以哪条消息为准。",
      },
      {
        title: "海报初稿",
        owner: "小王",
        due_label: "周五",
        due_date: null,
        priority: "medium",
        status: "done",
        confidence: "explicit",
        source_quote: "海报先让小王负责，周五提交初稿。",
        speaker: "林悦",
        evidence_quote: "海报初稿已经发到你邮箱了，先按这个方向。",
        needs_confirmation: false,
        note: null,
      },
      {
        title: "联系场地方，确认舞台尺寸与入场时间",
        owner: null,
        due_label: null,
        due_date: null,
        priority: "high",
        status: "todo",
        confidence: "explicit",
        source_quote: "场地那边还得有人联系场地方，确认舞台尺寸和入场时间。",
        speaker: "陈默",
        evidence_quote: null,
        needs_confirmation: true,
        note: "消息提到“得有人”，但没有指派任何责任人。",
      },
      {
        title: "舞台设计方案",
        owner: "林悦",
        due_label: "周三前",
        due_date: null,
        priority: "high",
        status: "todo",
        confidence: "explicit",
        source_quote: "舞台设计这块我来负责，周三前给方案。",
        speaker: "林悦",
        evidence_quote: null,
        needs_confirmation: true,
        note: "“周三前”是相对日期，未落到具体日历日。",
      },
    ],
    risks: [
      {
        type: "decision_unconfirmed",
        task_index: null,
        title: "“物料”范围与汇总人未确认",
        detail:
          "林悦提出“这周把发布会物料定下来”，但没有说明物料包含哪些内容、由谁汇总，也没有确认清单。",
        source_quote: "这周把发布会物料定下来吧。",
        severity: "medium",
      },
    ],
    warnings: [
      "当前为内置示例解析（规则引擎），没有调用 DeepSeek。",
      "“收到”只表示知悉，未被视为完成证据。",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Local rule-based fallback for arbitrary text (demo mode, never AI)  */
/* ------------------------------------------------------------------ */

import { hasCompletionEvidence, isAcknowledgment } from "./analysis";

const HEADER_RE =
  /^([\u4e00-\u9fa5A-Za-z0-9_\-]{1,20})\s+(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})$/;
const INLINE_SPEAKER_RE = /^([\u4e00-\u9fa5]{2,4})[:：]\s*(.+)$/;
const DUE_START_RE =
  /^(周[一二三四五六日天]|星期[一二三四五六日天]|下周|本周|这周|今天|明天|后天|\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})/;
const DUE_RE =
  /((?:下|这|本)?(?:周|星期)[一二三四五六日天](?:之前|前)?|今天|明天|后天|月底|下月初|\d{1,2}月\d{1,2}日(?:之前|前)?|\d{4}-\d{2}-\d{2})/;
const ACTION_RE =
  /负责|提交|联系|确认|安排|准备|整理|设计|跟进|对接|输出|交付|发送|发|完成|更新|检查|制作|搭建|预订|预定|采购|邀请|通知|排练|彩排|拍摄|剪辑|撰写|写|做|定|敲定|评估|测试|上线|发布/;

const OWNER_EXPLICIT_RE =
  /(?:让|由|请|安排|交给)\s*([\u4e00-\u9fa5]{2,4})(?:来|去)?(?:负责|做|跟进|对接|准备|整理|提交|联系|确认|设计|输出|交付)/;
const OWNER_PRONOUN_RE =
  /(我|你|他|她)(?:来|去)?(?:负责|做|跟进|对接|准备|整理|提交|联系|确认|设计|输出|交付)/;
const OWNER_NAME_RE =
  /([\u4e00-\u9fa5]{2,4})(?:负责|来做|来跟进|去联系|对接|跟进)/;

function extractOwner(
  clause: string,
  speaker: string | null,
): { owner: string | null; matched: string | null } {
  const explicit = OWNER_EXPLICIT_RE.exec(clause);
  if (explicit) return { owner: explicit[1], matched: explicit[0] };

  const pronoun = OWNER_PRONOUN_RE.exec(clause);
  if (pronoun) {
    const who = pronoun[1];
    return {
      owner: who === "我" ? speaker : null,
      matched: pronoun[0],
    };
  }

  const named = OWNER_NAME_RE.exec(clause);
  if (named) return { owner: named[1], matched: named[0] };

  return { owner: null, matched: null };
}

function cleanTitle(
  clause: string,
  ownerMatch: string | null,
  dueMatch: string | null,
): string {
  let title = clause;
  if (ownerMatch) title = title.replace(ownerMatch, "");
  if (dueMatch) title = title.replace(dueMatch, "");
  title = title
    .replace(/^(这周|本周|下周|另外|然后|还有|那|先|请|麻烦|记得|需要|得)\s*/, "")
    .replace(/[，,、：:；;。.]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/吧$/, "")
    .trim();
  if (title.length < 3) title = clause.trim();
  return title.slice(0, 60);
}

/**
 * Heuristic extractor used only when no API key is configured. Results are
 * always labelled as local rules, never as DeepSeek output.
 */
export function buildLocalExtraction(text: string): AiExtraction {
  if (text.trim() === DEMO_TEXT.trim()) {
    return buildDemoExtraction();
  }

  let speaker: string | null = null;
  const tasks: AiExtraction["tasks"] = [];
  const risks: AiExtraction["risks"] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = HEADER_RE.exec(line);
    if (header) {
      speaker = header[1];
      continue;
    }

    let content = line;
    const inline = INLINE_SPEAKER_RE.exec(line);
    if (inline) {
      speaker = inline[1];
      content = inline[2];
    }

    // Merge a leading "周五提交..." clause into the previous action clause.
    const rawClauses = content
      .split(/[。；;！!？?]/)
      .flatMap((segment) => segment.split(/[，,]/))
      .map((segment) => segment.trim())
      .filter(Boolean);

    const clauses: string[] = [];
    for (const clause of rawClauses) {
      if (DUE_START_RE.test(clause) && clauses.length > 0) {
        clauses[clauses.length - 1] = `${clauses[clauses.length - 1]}，${clause}`;
      } else {
        clauses.push(clause);
      }
    }

    for (const clause of clauses) {
      if (clause.length < 3) continue;

      const isQuestion = /[？?]$/.test(content) || /^(谁|是否|要不要|能不能|有没有)/.test(clause);
      if (isQuestion) {
        if (/谁|是否|要不要|能不能/.test(clause)) {
          risks.push({
            type: "decision_unconfirmed",
            task_index: null,
            title: "对话中存在待确认的问题",
            detail: `原文提出“${clause.slice(0, 80)}”，但对话中没有明确结论。`,
            source_quote: clause,
            severity: "medium",
          });
        }
        continue;
      }

      if (isAcknowledgment(clause)) continue;
      if (!ACTION_RE.test(clause)) continue;

      const { owner, matched } = extractOwner(clause, speaker);
      const dueMatch = DUE_RE.exec(clause);
      const dueLabel = dueMatch ? dueMatch[1] : null;
      const isoDate = dueLabel && /^\d{4}-\d{2}-\d{2}$/.test(dueLabel) ? dueLabel : null;
      const title = cleanTitle(clause, matched, dueMatch ? dueMatch[0] : null);
      if (!title || seen.has(title)) continue;
      seen.add(title);

      const done = hasCompletionEvidence(clause);
      const confidence =
        owner && dueLabel ? "explicit" : owner || dueLabel ? "inferred" : "unconfirmed";

      tasks.push({
        title,
        owner,
        due_label: isoDate ? null : dueLabel,
        due_date: isoDate,
        priority: /最终|老板|紧急|今天|明天/.test(clause) ? "high" : "medium",
        status: done ? "done" : "todo",
        confidence,
        source_quote: clause,
        speaker,
        evidence_quote: done ? clause : null,
        needs_confirmation: !owner || !dueLabel,
        note: done
          ? "本地规则检测到明确完成措辞，请核对。"
          : "本地规则解析，仅作演示，请逐项核对。",
      });
    }
  }

  const uniqueRisks = risks.filter(
    (risk, index, all) =>
      all.findIndex((item) => item.source_quote === risk.source_quote) === index,
  );

  return {
    project_name: null,
    transcript: null,
    summary: `本地规则解析（示例模式）：识别 ${tasks.length} 项任务、${uniqueRisks.length} 条待确认问题。结果未经 DeepSeek 校验，请逐项审核。`,
    tasks: tasks.slice(0, 12),
    risks: uniqueRisks.slice(0, 6),
    warnings: [
      "本地规则解析（示例模式），没有调用 DeepSeek，结果可能不完整。",
      "配置 DEEPSEEK_API_KEY 后可获得真实的 AI 抽取与截图理解。",
    ],
  };
}
