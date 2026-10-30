import { beforeEach, describe, expect, it } from "vitest";
import { setDatabaseForTests } from "@/lib/db";
import {
  confirmExtraction,
  createExtraction,
  createProject,
  createSource,
  getProjectBundle,
  getRisk,
  getTask,
  saveExtractionDraft,
  updateRisk,
  updateTask,
} from "@/lib/repo";
import type { DraftRisk, DraftTask, ExtractionPayload } from "@/lib/schemas";

const RAW = `林悦 10/12 15:22
海报的最终稿改成周四交，我要提前给老板看。
陈默 10/12 16:05
场地那边还得有人联系场地方，确认舞台尺寸和入场时间。`;

const tasks: DraftTask[] = [
  {
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
  },
  {
    id: "t2",
    title: "联系场地方",
    owner: null,
    dueLabel: null,
    dueDate: null,
    dateStatus: "unknown",
    priority: "high",
    status: "todo",
    confidence: "explicit",
    sourceQuote: "场地那边还得有人联系场地方，确认舞台尺寸和入场时间。",
    speaker: "陈默",
    evidenceQuote: null,
    needsConfirmation: true,
    note: null,
  },
];

const risks: DraftRisk[] = [
  {
    id: "r1",
    type: "owner_gap",
    severity: "high",
    title: "「联系场地方」无人负责",
    detail: "没有明确责任人。",
    sourceQuote: "场地那边还得有人联系场地方，确认舞台尺寸和入场时间。",
    taskRef: "t2",
    include: true,
  },
  {
    id: "r2",
    type: "due_unclear",
    severity: "medium",
    title: "「联系场地方」缺少截止时间",
    detail: "原文没有日期。",
    sourceQuote: "场地那边还得有人联系场地方，确认舞台尺寸和入场时间。",
    taskRef: "t2",
    include: true,
  },
];

const payload: ExtractionPayload = {
  summary: "两个任务",
  tasks,
  risks,
  warnings: [],
};

function seed() {
  const project = createProject("测试项目");
  const source = createSource({
    projectId: project.id,
    kind: "text",
    rawText: RAW,
    images: [],
    fileNames: [],
    mode: "demo",
    model: null,
  });
  const extraction = createExtraction({
    sourceId: source.id,
    projectId: project.id,
    payload,
    mode: "demo",
    model: null,
    warnings: [],
  });
  return { project, source, extraction };
}

describe("SQLite persistence", () => {
  beforeEach(() => {
    setDatabaseForTests(":memory:");
  });

  it("saves a reviewed extraction and its risks", () => {
    const { project, source, extraction } = seed();
    const result = confirmExtraction({
      extraction,
      tasks,
      risks,
      summary: payload.summary,
    });

    expect(result.projectId).toBe(project.id);
    expect(result.taskIds).toHaveLength(2);

    const bundle = getProjectBundle(project.id);
    expect(bundle).not.toBeNull();
    expect(bundle?.tasks).toHaveLength(2);
    expect(bundle?.risks).toHaveLength(2);
    expect(bundle?.risks.every((risk) => risk.taskId !== null)).toBe(true);
    expect(bundle?.sources[0].id).toBe(source.id);
    expect(bundle?.extractions[0].status).toBe("confirmed");
    expect(bundle?.tasks.every((task) => task.sourceQuote.length > 0)).toBe(true);
    expect(bundle?.events.length).toBeGreaterThanOrEqual(2);
  });

  it("persists task status changes and records events", () => {
    const { extraction } = seed();
    const { taskIds } = confirmExtraction({
      extraction,
      tasks,
      risks,
      summary: payload.summary,
    });
    const taskId = taskIds[0];

    const updated = updateTask(taskId, { status: "doing" });
    expect(updated?.status).toBe("doing");
    expect(getTask(taskId)?.status).toBe("doing");

    const events = getProjectBundle(extraction.projectId)?.events ?? [];
    expect(
      events.some(
        (event) =>
          event.taskId === taskId &&
          event.type === "status_changed" &&
          event.toValue === "doing",
      ),
    ).toBe(true);
  });

  it("persists field edits and closes a fixed owner gap", () => {
    const { extraction } = seed();
    const { taskIds } = confirmExtraction({
      extraction,
      tasks,
      risks,
      summary: payload.summary,
    });
    const venueTaskId = taskIds[1];

    const gapBefore = getProjectBundle(extraction.projectId)?.risks.find(
      (risk) => risk.taskId === venueTaskId && risk.type === "owner_gap",
    );
    expect(gapBefore?.status).toBe("open");

    const updated = updateTask(venueTaskId, {
      owner: "陈默",
      dueDate: "2026-10-20",
    });
    expect(updated?.owner).toBe("陈默");
    expect(updated?.dateStatus).toBe("confirmed");

    const bundle = getProjectBundle(extraction.projectId);
    const gapAfter = bundle?.risks.find((risk) => risk.id === gapBefore?.id);
    expect(gapAfter?.status).toBe("resolved");
    expect(gapAfter?.resolutionNote).toContain("系统自动");

    const dueRisk = bundle?.risks.find(
      (risk) => risk.taskId === venueTaskId && risk.type === "due_unclear",
    );
    expect(dueRisk?.status).toBe("resolved");
  });

  it("reopens an owner-gap risk when the owner is cleared", () => {
    const { extraction } = seed();
    const { taskIds } = confirmExtraction({
      extraction,
      tasks,
      risks,
      summary: payload.summary,
    });
    const venueTaskId = taskIds[1];

    updateTask(venueTaskId, { owner: "陈默" });
    let bundle = getProjectBundle(extraction.projectId);
    expect(
      bundle?.risks.filter(
        (risk) => risk.taskId === venueTaskId && risk.type === "owner_gap",
      ),
    ).toHaveLength(1);
    expect(
      bundle?.risks.find(
        (risk) => risk.taskId === venueTaskId && risk.type === "owner_gap",
      )?.status,
    ).toBe("resolved");

    updateTask(venueTaskId, { owner: null });
    bundle = getProjectBundle(extraction.projectId);
    const gaps = bundle?.risks.filter(
      (risk) => risk.taskId === venueTaskId && risk.type === "owner_gap",
    );
    expect(gaps).toHaveLength(2);
    expect(gaps?.some((risk) => risk.status === "open")).toBe(true);
  });

  it("lets users resolve, annotate, and reopen a risk", () => {
    const { extraction } = seed();
    confirmExtraction({ extraction, tasks, risks, summary: payload.summary });
    const bundle = getProjectBundle(extraction.projectId);
    const risk = bundle!.risks[0];

    const resolved = updateRisk(risk.id, {
      status: "resolved",
      note: "已指派陈默负责",
    });
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolutionNote).toBe("已指派陈默负责");
    expect(resolved?.resolvedAt).toBeTruthy();

    const reopened = updateRisk(risk.id, { status: "open" });
    expect(reopened?.status).toBe("open");
    expect(reopened?.resolvedAt).toBeNull();
    expect(reopened?.resolutionNote).toBeNull();

    const riskRecord = getRisk(risk.id);
    expect(riskRecord?.status).toBe("open");
  });

  it("saves draft edits without writing tasks", () => {
    const { project, extraction } = seed();
    const edited: ExtractionPayload = {
      ...payload,
      summary: "修改后的草稿",
      tasks: [tasks[0]],
    };
    saveExtractionDraft(extraction.id, edited);

    const bundle = getProjectBundle(project.id);
    expect(bundle?.tasks).toHaveLength(0);
    expect(bundle?.extractions[0].summary).toBe("修改后的草稿");
    expect(bundle?.extractions[0].payload.tasks).toHaveLength(1);
  });
});
