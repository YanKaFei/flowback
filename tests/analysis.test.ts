import { describe, expect, it } from "vitest";
import {
  buildPayload,
  finalizeRisks,
  hasCompletionEvidence,
  isAcknowledgment,
  normalizeAiExtraction,
  reconcileTasks,
  titleKeywords,
} from "@/lib/analysis";
import { buildDemoExtraction, DEMO_TEXT } from "@/lib/demo";
import {
  aiExtractionSchema,
  type AiExtraction,
  type DraftRisk,
  type DraftTask,
} from "@/lib/schemas";

function baseTask(overrides: Partial<DraftTask> = {}): DraftTask {
  return {
    id: "t1",
    title: "海报最终稿",
    owner: "小王",
    dueLabel: "周四",
    dueDate: null,
    dateStatus: "relative",
    priority: "high",
    status: "todo",
    confidence: "explicit",
    sourceQuote: "海报的最终稿改成周四交，我要提前给老板看。",
    speaker: "林悦",
    evidenceQuote: null,
    needsConfirmation: true,
    note: null,
    ...overrides,
  };
}

describe("demo case", () => {
  const payload = buildPayload(buildDemoExtraction(), DEMO_TEXT);

  it("extracts the four expected tasks", () => {
    expect(payload.tasks).toHaveLength(4);
    expect(payload.tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(["海报最终稿", "海报初稿", "舞台设计方案"]),
    );
    expect(
      payload.tasks.some((task) => task.title.includes("联系场地方")),
    ).toBe(true);
  });

  it("keeps an explicit deadline conflict between 周四 and 周五", () => {
    const conflict = payload.risks.find((risk) => risk.type === "due_conflict");
    expect(conflict).toBeDefined();
    expect(conflict?.detail).toContain("周四");
    expect(conflict?.detail).toContain("周五");
    expect(conflict?.sourceQuote).toContain("周四交");
    expect(conflict?.severity).toBe("high");
  });

  it("flags the unowned venue task", () => {
    const venue = payload.tasks.find((task) => task.title.includes("场地方"));
    expect(venue?.owner).toBeNull();
    const gap = payload.risks.find(
      (risk) => risk.type === "owner_gap" && risk.taskRef === venue?.id,
    );
    expect(gap).toBeDefined();
    expect(gap?.sourceQuote).toContain("得有人联系场地方");
  });

  it("flags a missing deadline and an unconfirmed decision", () => {
    const types = new Set(payload.risks.map((risk) => risk.type));
    expect(types.has("due_unclear")).toBe(true);
    expect(types.has("decision_unconfirmed")).toBe(true);
  });

  it("never treats 收到 as completion", () => {
    expect(isAcknowledgment("收到")).toBe(true);
    expect(hasCompletionEvidence("收到")).toBe(false);
    expect(payload.tasks.every((task) => !task.title.includes("收到"))).toBe(
      true,
    );
    const doneTasks = payload.tasks.filter((task) => task.status === "done");
    expect(doneTasks).toHaveLength(1);
    expect(doneTasks[0].title).toBe("海报初稿");
    expect(doneTasks[0].evidenceQuote).toContain("已经发到你邮箱了");
  });

  it("keeps quotes traceable to the source", () => {
    for (const task of payload.tasks) {
      expect(DEMO_TEXT).toContain(task.sourceQuote);
      expect(task.confidence).toBe("explicit");
    }
  });
});

describe("completion evidence rules", () => {
  it("accepts concrete completion language", () => {
    expect(hasCompletionEvidence("海报初稿已经发到你邮箱了")).toBe(true);
    expect(hasCompletionEvidence("已完成")).toBe(true);
  });

  it("rejects acknowledgements and empty evidence", () => {
    for (const quote of ["收到", "好的", "嗯嗯", "OK", "", null]) {
      expect(hasCompletionEvidence(quote)).toBe(false);
    }
  });

  it("downgrades a done task without evidence and warns", () => {
    const ai: AiExtraction = aiExtractionSchema.parse({
      summary: "test",
      tasks: [
        {
          title: "发海报",
          owner: "小王",
          due_label: "周五",
          due_date: null,
          priority: "high",
          status: "done",
          confidence: "explicit",
          source_quote: "收到",
          speaker: "小王",
          evidence_quote: null,
          needs_confirmation: false,
        },
      ],
      risks: [],
      warnings: [],
    });
    const normalized = normalizeAiExtraction(ai);
    expect(normalized.tasks[0].status).toBe("todo");
    expect(normalized.warnings.join(" ")).toContain("缺少明确的完成证据");
  });

  it("marks unmatched quotes as unconfirmed", () => {
    const ai = aiExtractionSchema.parse({
      summary: "",
      tasks: [
        {
          title: "写测试",
          owner: "小李",
          source_quote: "这句话不在原文里",
          priority: "medium",
          status: "todo",
          confidence: "explicit",
          needs_confirmation: false,
        },
      ],
      risks: [],
      warnings: [],
    });
    const payload = buildPayload(ai, "完全不同的聊天内容");
    expect(payload.tasks[0].confidence).toBe("unconfirmed");
    expect(payload.tasks[0].needsConfirmation).toBe(true);
    expect(payload.warnings.join(" ")).toContain("未能在原文");
  });
});

describe("risk derivation", () => {
  it("links tasks by shared Chinese keywords", () => {
    expect(titleKeywords("海报最终稿")).toContain("海报");
    expect(
      titleKeywords("海报最终稿").filter((keyword) =>
        titleKeywords("海报初稿").includes(keyword),
      ),
    ).toContain("海报");
  });

  it("respects an explicit review-level exclusion", () => {
    const task = baseTask({ owner: null, dueLabel: null, dateStatus: "unknown" });
    const excluded: DraftRisk = {
      id: "r1",
      type: "owner_gap",
      severity: "high",
      title: "无人负责",
      detail: "",
      sourceQuote: task.sourceQuote,
      taskRef: task.id,
      include: false,
    };
    const result = finalizeRisks([task], [excluded]);
    expect(result.some((risk) => risk.type === "owner_gap")).toBe(false);
  });

  it("recomputes an auto conflict when review edits remove it", () => {
    const a = baseTask({ id: "t1", title: "海报最终稿", dueLabel: "周五" });
    const b = baseTask({ id: "t2", title: "海报初稿", dueLabel: "周五" });
    const stale: DraftRisk = {
      id: "auto-conflict-t1-t2",
      type: "due_conflict",
      severity: "high",
      title: "「海报」截止时间不一致",
      detail: "旧冲突",
      sourceQuote: "海报的最终稿改成周四交，我要提前给老板看。",
      taskRef: "t2",
      include: true,
    };
    const result = finalizeRisks([a, b], [stale]);
    expect(result.some((risk) => risk.type === "due_conflict")).toBe(false);
  });

  it("does not invent a conflict when deadlines match", () => {
    const a = baseTask({ id: "a", title: "海报初稿", dueLabel: "周五" });
    const b = baseTask({ id: "b", title: "海报最终稿", dueLabel: "周五" });
    const payload = buildPayload(
      aiExtractionSchema.parse({
        summary: "",
        tasks: [a, b].map((task) => ({
          title: task.title,
          owner: task.owner,
          due_label: task.dueLabel,
          due_date: null,
          source_quote: task.sourceQuote,
          status: "todo",
          confidence: "explicit",
          priority: "medium",
        })),
        risks: [],
        warnings: [],
      }),
      DEMO_TEXT,
    );
    expect(
      payload.risks.some((risk) => risk.type === "due_conflict"),
    ).toBe(false);
  });
});

describe("risk noise and image transcript verification", () => {
  it("drops a model due_unclear when the task already has a relative deadline", () => {
    const ai = aiExtractionSchema.parse({
      summary: "",
      tasks: [
        {
          title: "提交初稿",
          owner: "小王",
          due_label: "周五",
          source_quote: "海报先让小王负责，周五提交初稿。",
          status: "todo",
          confidence: "explicit",
          priority: "medium",
        },
      ],
      risks: [
        {
          type: "due_unclear",
          task_index: 1,
          title: "初稿截止仅有相对时间",
          detail: "没有年份",
          source_quote: "海报先让小王负责，周五提交初稿。",
          severity: "medium",
        },
      ],
      warnings: [],
    });
    const payload = buildPayload(ai, DEMO_TEXT);
    expect(payload.risks.some((risk) => risk.type === "due_unclear")).toBe(false);
  });

  it("verifies screenshot quotes against the model transcript", () => {
    const transcript = "王可 09:00\n请在周五前提交设计稿。";
    const exact = aiExtractionSchema.parse({
      transcript,
      summary: "",
      tasks: [
        {
          title: "提交设计稿",
          owner: "王可",
          due_label: "周五",
          source_quote: "请在周五前提交设计稿。",
          status: "todo",
          confidence: "explicit",
          priority: "high",
        },
      ],
      risks: [],
      warnings: [],
    });
    const payload = buildPayload(exact, "");
    expect(payload.tasks[0].confidence).toBe("explicit");

    const paraphrased = aiExtractionSchema.parse({
      transcript,
      summary: "",
      tasks: [
        {
          title: "提交设计稿",
          owner: "王可",
          due_label: "周五",
          source_quote: "请在周五提交稿件。",
          status: "todo",
          confidence: "explicit",
          priority: "high",
        },
      ],
      risks: [],
      warnings: [],
    });
    const downgraded = buildPayload(paraphrased, "");
    expect(downgraded.tasks[0].confidence).toBe("unconfirmed");
    expect(downgraded.warnings.join(" ")).toContain("未能在原文");
  });
});

describe("grounded owners and decision-risk noise", () => {
  it("clears an owner that only appears as a speaker, not an assignment", () => {
    const text =
      "产品评审群\n赵可 14:00\n登录页先保留手机号登录，这期不做微信登录。\n孙鸣 14:02\n明白，那这期就按手机号登录做。\n赵可 14:25\n等等，老板刚说还是加上微信登录，下周一起评审。\n孙鸣 14:27\n好";
    const ai = aiExtractionSchema.parse({
      summary: "",
      tasks: [
        {
          title: "实现登录页",
          owner: "孙鸣",
          due_label: "下周",
          source_quote: "等等，老板刚说还是加上微信登录，下周一起评审。",
          status: "todo",
          confidence: "explicit",
          priority: "high",
        },
      ],
      risks: [],
      warnings: [],
    });
    const payload = buildPayload(ai, text);
    expect(payload.tasks[0].owner).toBeNull();
    expect(payload.tasks[0].needsConfirmation).toBe(true);
    expect(payload.risks.some((risk) => risk.type === "owner_gap")).toBe(true);
  });

  it("keeps an owner explicitly assigned in the surrounding transcript", () => {
    const text =
      "活动执行群\n林悦 15:00\n主视觉海报最终稿周四交，小王负责。\n小王 15:02\n收到\n林悦 15:07\n海报初稿改周五交。";
    const ai = aiExtractionSchema.parse({
      summary: "",
      tasks: [
        {
          title: "提交海报初稿",
          owner: "小王",
          due_label: "周五",
          source_quote: "海报初稿改周五交。",
          status: "todo",
          confidence: "inferred",
          priority: "high",
        },
      ],
      risks: [],
      warnings: [],
    });
    const payload = buildPayload(ai, text);
    expect(payload.tasks[0].owner).toBe("小王");
  });

  it("drops a decision risk whose quote has no decision marker", () => {
    const transcript = "设计协作群\n王可 09:15\n前端联调我这边来，10月25日前进测试。";
    const ai = aiExtractionSchema.parse({
      transcript,
      summary: "",
      tasks: [
        {
          title: "完成前端联调",
          owner: "王可",
          due_label: "10月25日前",
          source_quote: "前端联调我这边来，10月25日前进测试。",
          status: "todo",
          confidence: "explicit",
          priority: "high",
        },
      ],
      risks: [
        {
          type: "decision_unconfirmed",
          task_index: 1,
          title: "验收口径未明确",
          detail: "普通任务缺验收标准",
          source_quote: "前端联调我这边来，10月25日前进测试。",
          severity: "medium",
        },
      ],
      warnings: [],
    });
    const payload = buildPayload(ai, "");
    expect(payload.risks.some((risk) => risk.type === "decision_unconfirmed")).toBe(false);
  });
});

describe("date reconciliation", () => {
  it("derives dateStatus from edited values", () => {
    const [withDate] = reconcileTasks([
      baseTask({ dueDate: "2026-10-15", dueLabel: "周四" }),
    ]);
    expect(withDate.dateStatus).toBe("confirmed");

    const [relative] = reconcileTasks([
      baseTask({ dueDate: null, dueLabel: "周四" }),
    ]);
    expect(relative.dateStatus).toBe("relative");

    const [unknown] = reconcileTasks([
      baseTask({ dueDate: null, dueLabel: null }),
    ]);
    expect(unknown.dateStatus).toBe("unknown");
  });
});
