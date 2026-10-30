import type {
  AiExtraction,
  DraftRisk,
  DraftTask,
  ExtractionPayload,
  RiskType,
  Severity,
} from "./schemas";
import { ISO_DATE } from "./schemas";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const ACK_RE =
  /^(收到|收到啦|好的|好|嗯|嗯嗯|ok|OK|Ok|知道了|明白|明白啦|行|可以|没问题)[。.!！?？~～…\s]*$/;

const COMPLETION_RE =
  /(已发|已经发|已提交|提交了|已交付|交付了|已完成|完成了|已上传|上传了|已发出|发出|发到|做完|搞定|上线|done)/i;

export function isAcknowledgment(quote: string | null | undefined): boolean {
  if (!quote) return false;
  return ACK_RE.test(quote.trim());
}

/** Completion needs explicit evidence in the source text, never an ack. */
export function hasCompletionEvidence(quote: string | null | undefined): boolean {
  if (!quote) return false;
  const trimmed = quote.trim();
  if (trimmed.length < 2) return false;
  if (isAcknowledgment(trimmed)) return false;
  return COMPLETION_RE.test(trimmed);
}

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(ai: {
  due_date: string | null;
  due_label: string | null;
}): {
  dueDate: string | null;
  dueLabel: string | null;
  dateStatus: DraftTask["dateStatus"];
} {
  let dueDate: string | null = null;
  let dueLabel = cleanString(ai.due_label);

  if (ai.due_date) {
    const raw = ai.due_date.trim();
    if (ISO_DATE.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00`).getTime())) {
      dueDate = raw;
    } else if (!dueLabel) {
      dueLabel = raw;
    }
  }

  return {
    dueDate,
    dueLabel,
    dateStatus: dueDate ? "confirmed" : dueLabel ? "relative" : "unknown",
  };
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function pruneCoveredRisks(
  tasks: DraftTask[],
  risks: DraftRisk[],
): DraftRisk[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return risks.filter((risk) => {
    if (risk.type === "decision_unconfirmed" && risk.sourceQuote) {
      const decisionMarker =
        /(决定|方案|范围|口径|是否|要不要|还是|改成|评审|确认|登录|保留|不做|采用|上线|定下来|敲定|迁移)/;
      if (!decisionMarker.test(risk.sourceQuote)) return false;
    }
    if (!risk.taskRef) return true;
    const task = byId.get(risk.taskRef);
    if (!task) return true;
    if (risk.type === "owner_gap" && task.owner) return false;
    if (risk.type === "due_unclear" && (task.dueLabel || task.dueDate)) {
      return false;
    }
    return true;
  });
}

const OWNER_ASSIGNMENT =
  /(负责|来做|来写|来跟进|来设计|来联系|我来|我这边|我负责|我写|我做|跟进|对接|交付|提交|联系|确认|安排|交给|请|由|让|更新|撰写|输出|准备)/;

function ownerIsGrounded(task: DraftTask, sourceText: string): boolean {
  if (!task.owner) return true;
  if (task.sourceQuote.includes(task.owner)) return true;
  if (
    task.owner === task.speaker &&
    /我(来|这边|负责|写|做|跟进|联系|准备|安排)/.test(task.sourceQuote)
  ) {
    return true;
  }
  if (!sourceText.trim()) return true;
  let index = 0;
  while ((index = sourceText.indexOf(task.owner, index)) !== -1) {
    const window = sourceText.slice(
      Math.max(0, index - 24),
      index + task.owner.length + 36,
    );
    if (OWNER_ASSIGNMENT.test(window)) return true;
    index += task.owner.length;
  }
  return false;
}

export function sanitizeTaskOwners(
  tasks: DraftTask[],
  sourceText: string,
): { tasks: DraftTask[]; warnings: string[] } {
  const warnings: string[] = [];
  const next = tasks.map((task) => {
    if (!task.owner || ownerIsGrounded(task, sourceText)) return task;
    warnings.push(
      `「${task.title}」的负责人在原文中没有明确指派，已清空为无人负责，请人工确认。`,
    );
    return {
      ...task,
      owner: null,
      needsConfirmation: true,
    };
  });
  return { tasks: next, warnings };
}

const GENERIC_KEYWORDS = new Set([
  "提交",
  "确认",
  "完成",
  "负责",
  "设计",
  "方案",
  "最终",
  "初稿",
  "相关",
  "需要",
  "进行",
  "一个",
  "我们",
  "这个",
  "截止",
  "时间",
  "内容",
  "准备",
  "联系",
  "沟通",
  "以及",
  "follow",
]);

/** Extract Chinese bigrams / latin words used to link tasks about the same thing. */
export function titleKeywords(title: string): string[] {
  const cleaned = title.replace(/[（(][^）)]*[）)]/g, " ");
  const runs = cleaned.match(/[\u4e00-\u9fa5]+|[a-zA-Z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const run of runs) {
    if (/^[a-zA-Z0-9]+$/.test(run)) {
      if (run.length >= 3) out.add(run.toLowerCase());
      continue;
    }
    const chars = Array.from(run);
    for (let i = 0; i < chars.length - 1; i += 1) {
      const gram = chars[i] + chars[i + 1];
      if (!GENERIC_KEYWORDS.has(gram)) out.add(gram);
    }
  }
  return Array.from(out);
}

/* ------------------------------------------------------------------ */
/* AI wire -> review payload                                           */
/* ------------------------------------------------------------------ */

export function normalizeAiExtraction(ai: AiExtraction): ExtractionPayload {
  const warnings = [...ai.warnings];

  const tasks: DraftTask[] = ai.tasks.map((item, index) => {
    const { dueDate, dueLabel, dateStatus } = normalizeDate(item);
    const owner = cleanString(item.owner);
    const evidence = cleanString(item.evidence_quote);
    const quote = cleanString(item.source_quote) ?? "";

    let status: DraftTask["status"] = item.status;
    if (status === "done" && !hasCompletionEvidence(evidence)) {
      status = "todo";
      warnings.push(
        `「${item.title}」被模型标记为完成，但原文缺少明确的完成证据，已回退为待处理。`,
      );
    }

    const needsConfirmation =
      item.needs_confirmation ??
      (item.confidence !== "explicit" || !owner || dateStatus !== "confirmed");

    return {
      id: `t${index + 1}`,
      title: item.title,
      owner,
      dueLabel,
      dueDate,
      dateStatus,
      priority: item.priority,
      status,
      confidence: item.confidence,
      sourceQuote: quote,
      speaker: cleanString(item.speaker),
      evidenceQuote: evidence,
      needsConfirmation,
      note: cleanString(item.note),
    };
  });

  const risks: DraftRisk[] = ai.risks.map((risk, index) => {
    const taskRef =
      risk.task_index && tasks[risk.task_index - 1]
        ? tasks[risk.task_index - 1].id
        : null;
    const fallbackQuote = taskRef
      ? tasks.find((t) => t.id === taskRef)?.sourceQuote ?? ""
      : "";
    return {
      id: `r${index + 1}`,
      type: risk.type,
      severity: risk.severity,
      title: risk.title,
      detail: risk.detail,
      sourceQuote: cleanString(risk.source_quote) ?? fallbackQuote,
      taskRef,
      include: true,
    };
  });

  const summary =
    cleanString(ai.summary) ??
    `已提取 ${tasks.length} 项任务、${risks.length} 项待核对风险。`;

  return { summary, tasks, risks: sortRisks(risks), warnings };
}

/* ------------------------------------------------------------------ */
/* Quote traceability                                                  */
/* ------------------------------------------------------------------ */

function compact(value: string): string {
  return value.replace(/\s+/g, "").replace(/[“”"'']/g, "").trim();
}

/**
 * Every quote should be a real substring of the source. When it is not, the
 * item is downgraded to "needs confirmation" instead of being silently trusted.
 */
export function verifyQuotes(
  payload: ExtractionPayload,
  rawText: string,
): ExtractionPayload {
  if (!rawText.trim()) return payload;
  const haystack = compact(rawText);
  let changed = false;
  const warnings = [...payload.warnings];

  const tasks = payload.tasks.map((task) => {
    const quote = task.sourceQuote.trim();
    if (!quote) {
      changed = true;
      warnings.push(`「${task.title}」缺少原文引用，已标记为待核对。`);
      return {
        ...task,
        confidence: "unconfirmed" as const,
        needsConfirmation: true,
      };
    }
    if (!haystack.includes(compact(quote))) {
      changed = true;
      warnings.push(`「${task.title}」的引用未能在原文中逐字匹配，已标记为待核对。`);
      return {
        ...task,
        confidence: "unconfirmed" as const,
        needsConfirmation: true,
        note: task.note
          ? `${task.note}（引用未匹配原文）`
          : "引用未在原文中逐字匹配，请人工核对。",
      };
    }
    return task;
  });

  const risks = payload.risks.map((risk) => {
    if (!risk.sourceQuote) {
      changed = true;
      warnings.push(`风险「${risk.title}」缺少原文引用，已标记为待核对。`);
      return { ...risk, severity: "high" as const };
    }
    if (!haystack.includes(compact(risk.sourceQuote))) {
      changed = true;
      warnings.push(`风险「${risk.title}」的引用未能在原文中逐字匹配。`);
      return {
        ...risk,
        severity: "high" as const,
        detail: `${risk.detail}（引用未匹配原文，请人工核对）`.slice(0, 400),
      };
    }
    return risk;
  });

  if (!changed) return payload;
  return { ...payload, tasks, risks, warnings: dedupeWarnings(warnings) };
}

function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings)).slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Deterministic risk derivation                                       */
/* ------------------------------------------------------------------ */

function sortRisks(risks: DraftRisk[]): DraftRisk[] {
  return [...risks].sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return a.title.localeCompare(b.title, "zh-Hans-CN");
  });
}

function coveredBy(
  risks: DraftRisk[],
  type: RiskType,
  task: DraftTask,
): boolean {
  return risks.some(
    (risk) =>
      risk.type === type &&
      (risk.taskRef === task.id ||
        (!risk.taskRef && risk.sourceQuote === task.sourceQuote)),
  );
}

/**
 * Rules that don't depend on the model: missing owner, missing date, and two
 * different deadlines for the same owner + same deliverable keyword.
 */
export function deriveRisks(
  tasks: DraftTask[],
  baseRisks: DraftRisk[],
): DraftRisk[] {
  const risks = baseRisks.map((r) => ({ ...r }));
  const push = (risk: DraftRisk) => {
    const dup = risks.some(
      (existing) =>
        existing.id === risk.id ||
        (existing.type === risk.type &&
          existing.taskRef === risk.taskRef &&
          existing.title === risk.title),
    );
    if (!dup) risks.push(risk);
  };

  for (const task of tasks) {
    if (!task.owner && task.status !== "done") {
      if (!coveredBy(risks, "owner_gap", task)) {
        push({
          id: `auto-owner-${task.id}`,
          type: "owner_gap",
          severity: "high",
          title: `「${task.title}」无人负责`,
          detail: `原文提到了这项工作，但没有明确责任人。截止信息：${
            task.dueLabel ?? "未定"
          }。请指派负责人后再执行。`,
          sourceQuote: task.sourceQuote,
          taskRef: task.id,
          include: true,
        });
      }
    }

    if (
      task.status !== "done" &&
      !task.dueDate &&
      !task.dueLabel &&
      !coveredBy(risks, "due_unclear", task)
    ) {
      push({
        id: `auto-due-${task.id}`,
        type: "due_unclear",
        severity: "medium",
        title: `「${task.title}」缺少截止时间`,
        detail: "原文没有给出任何截止日期，需要补充一个明确日期。",
        sourceQuote: task.sourceQuote,
        taskRef: task.id,
        include: true,
      });
    }
  }

  // Pairwise deadline conflicts for the same owner + shared deliverable keyword.
  for (let i = 0; i < tasks.length; i += 1) {
    for (let j = i + 1; j < tasks.length; j += 1) {
      const a = tasks[i];
      const b = tasks[j];
      if (!a.owner || a.owner !== b.owner) continue;
      if (a.status === "done" && b.status === "done") continue;
      const dueA = a.dueDate ?? a.dueLabel;
      const dueB = b.dueDate ?? b.dueLabel;
      if (!dueA || !dueB || dueA === dueB) continue;

      const keysA = new Set(titleKeywords(a.title));
      const shared = titleKeywords(b.title).filter((k) => keysA.has(k));
      if (shared.length === 0) continue;

      const already = risks.some(
        (risk) =>
          risk.type === "due_conflict" &&
          (risk.taskRef === a.id || risk.taskRef === b.id),
      );
      if (already) continue;

      const keyword = shared[0];
      const combinedQuote = `${a.sourceQuote} / ${b.sourceQuote}`.slice(0, 480);
      push({
        id: `auto-conflict-${a.id}-${b.id}`,
        type: "due_conflict",
        severity: "high",
        title: `「${keyword}」截止时间不一致`,
        detail: `《${a.title}》截止 ${dueA}，《${b.title}》截止 ${dueB}。同一负责人（${a.owner}）下出现两个不同时间，需确认以哪条消息为准。`,
        sourceQuote: combinedQuote,
        taskRef: a.id,
        include: true,
      });
    }
  }

  return sortRisks(risks);
}

/* ------------------------------------------------------------------ */
/* Full pipeline used by both AI and demo modes                        */
/* ------------------------------------------------------------------ */

export function buildPayload(
  ai: AiExtraction,
  rawText: string,
): ExtractionPayload {
  const normalized = normalizeAiExtraction(ai);
  // Text sources use the pasted transcript. Screenshot-only sources use the
  // model's own transcript so a quote missing characters is downgraded.
  const verificationText = rawText.trim() || ai.transcript?.trim() || "";
  const owners = sanitizeTaskOwners(normalized.tasks, verificationText);
  const normalizedWithOwners: ExtractionPayload = {
    ...normalized,
    tasks: owners.tasks,
    warnings: dedupeWarnings([...normalized.warnings, ...owners.warnings]),
  };
  const verified = verifyQuotes(normalizedWithOwners, verificationText);
  // Drop model risks that are already represented by task fields; the UI
  // shows relative-date/assigned-owner badges, so repeating them as risks is
  // noise that hides the genuinely unowned/missing-date items.
  const pruned = {
    ...verified,
    risks: pruneCoveredRisks(verified.tasks, verified.risks),
  };
  const risks = deriveRisks(pruned.tasks, pruned.risks);
  return {
    ...pruned,
    risks,
    warnings: dedupeWarnings(pruned.warnings),
  };
}

/** Reconcile user edits before writing to SQLite. */
/** Screenshot sources without a transcript cannot be quote-verified. */
export function markUnverifiedImageQuotes(
  payload: ExtractionPayload,
): ExtractionPayload {
  return {
    ...payload,
    tasks: payload.tasks.map((task) => ({
      ...task,
      confidence: "unconfirmed" as const,
      needsConfirmation: true,
    })),
    warnings: dedupeWarnings([
      ...payload.warnings,
      "截图来源没有返回转写文本，任务引用无法自动核验，已全部标记为待确认。",
    ]),
  };
}

export function reconcileTasks(tasks: DraftTask[]): DraftTask[] {
  return tasks.map((task) => {
    const dueDate =
      task.dueDate && ISO_DATE.test(task.dueDate) ? task.dueDate : null;
    const dueLabel = cleanString(task.dueLabel);
    const owner = cleanString(task.owner);
    const dateStatus = dueDate ? "confirmed" : dueLabel ? "relative" : "unknown";
    const status =
      task.status === "done" && !hasCompletionEvidence(task.evidenceQuote)
        ? "todo"
        : task.status;

    return {
      ...task,
      title: task.title.trim(),
      owner,
      dueLabel,
      dueDate,
      dateStatus,
      status,
      sourceQuote: task.sourceQuote.trim(),
      speaker: cleanString(task.speaker),
      evidenceQuote: cleanString(task.evidenceQuote),
      note: cleanString(task.note),
    };
  });
}

/**
 * Risks kept at confirmation time: user-included risks linked to surviving
 * tasks, plus rules re-run on the edited tasks.
 */
export function finalizeRisks(
  tasks: DraftTask[],
  risks: DraftRisk[],
): DraftRisk[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const kept = risks
    .filter((risk) => risk.include)
    .filter((risk) => {
      if (risk.taskRef === null) return true;
      const task = taskById.get(risk.taskRef);
      if (!task) return false;
      // A field was fixed during review: drop the stale structural finding.
      if (risk.type === "owner_gap" && task.owner) return false;
      if (
        risk.type === "due_unclear" &&
        (task.dueDate || task.dueLabel)
      ) {
        return false;
      }
      return true;
    })
    // Auto-generated findings are recomputed against the edited tasks so
    // deadlines changed in review cannot leave a stale conflict behind.
    .filter((risk) => !risk.id.startsWith("auto-"))
    .map((risk) => ({ ...risk, include: true }));

  // Respect an explicit review-level exclusion: the rule engine must not
  // immediately re-create a risk the reviewer just removed.
  const excluded = risks.filter((risk) => !risk.include);
  const derived = deriveRisks(tasks, kept);
  return derived.filter(
    (risk) =>
      !excluded.some(
        (item) =>
          item.type === risk.type &&
          item.taskRef === risk.taskRef &&
          (item.sourceQuote === risk.sourceQuote || item.title === risk.title),
      ),
  );
}
