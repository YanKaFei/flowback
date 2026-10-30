import { describe, expect, it } from "vitest";
import {
  aiExtractionSchema,
  analyzeRequestSchema,
  confirmExtractionSchema,
  draftTaskSchema,
  updateTaskSchema,
} from "@/lib/schemas";

const validTask = {
  id: "t1",
  title: "海报最终稿",
  owner: "小王",
  dueLabel: "周四",
  dueDate: null,
  dateStatus: "relative",
  priority: "high",
  status: "todo",
  confidence: "explicit",
  sourceQuote: "海报的最终稿改成周四交",
  speaker: "林悦",
  evidenceQuote: null,
  needsConfirmation: true,
  note: null,
};

const tinyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

describe("request validation", () => {
  it("requires text or images", () => {
    expect(analyzeRequestSchema.safeParse({ text: "", images: [] }).success).toBe(
      false,
    );
    expect(analyzeRequestSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("accepts a valid text request", () => {
    const result = analyzeRequestSchema.safeParse({
      text: "小王负责海报，周五提交",
      images: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an allowed screenshot but rejects unsupported formats", () => {
    const ok = analyzeRequestSchema.safeParse({
      text: "",
      images: [{ name: "chat.png", mime: "image/png", dataUrl: tinyImage }],
    });
    expect(ok.success).toBe(true);

    const bad = analyzeRequestSchema.safeParse({
      text: "",
      images: [
        {
          name: "chat.gif",
          mime: "image/gif",
          dataUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        },
      ],
    });
    expect(bad.success).toBe(false);
  });

  it("caps screenshot count at 4", () => {
    const images = Array.from({ length: 5 }, (_, index) => ({
      name: `chat-${index}.png`,
      mime: "image/png" as const,
      dataUrl: tinyImage,
    }));
    const result = analyzeRequestSchema.safeParse({ text: "", images });
    expect(result.success).toBe(false);
  });

  it("rejects a mismatched image data url prefix", () => {
    const result = analyzeRequestSchema.safeParse({
      text: "",
      images: [
        {
          name: "chat.png",
          mime: "image/png",
          dataUrl: "data:text/plain;base64,aGVsbG8=",
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("AI wire schema", () => {
  it("parses a normal JSON payload", () => {
    const parsed = aiExtractionSchema.safeParse({
      project_name: "发布会",
      summary: "两个任务",
      tasks: [
        {
          title: "联系场地方",
          owner: null,
          due_label: null,
          due_date: null,
          priority: "high",
          status: "todo",
          confidence: "explicit",
          source_quote: "场地那边得有人联系",
          needs_confirmation: true,
        },
      ],
      risks: [
        {
          type: "owner_gap",
          task_index: 1,
          title: "无人负责",
          detail: "没有指派",
          source_quote: "场地那边得有人联系",
          severity: "high",
        },
      ],
      warnings: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tasks[0].title).toBe("联系场地方");
      expect(parsed.data.risks[0].type).toBe("owner_gap");
    }
  });

  it("rejects invalid enums and missing titles", () => {
    const badPriority = aiExtractionSchema.safeParse({
      summary: "",
      tasks: [{ title: "A", priority: "urgent", source_quote: "A" }],
      risks: [],
      warnings: [],
    });
    expect(badPriority.success).toBe(false);

    const noTitle = aiExtractionSchema.safeParse({
      summary: "",
      tasks: [{ source_quote: "A" }],
      risks: [],
      warnings: [],
    });
    expect(noTitle.success).toBe(false);
  });
});

describe("draft and confirm schemas", () => {
  it("rejects empty task titles", () => {
    expect(draftTaskSchema.safeParse({ ...validTask, title: "  " }).success).toBe(
      false,
    );
    expect(draftTaskSchema.safeParse(validTask).success).toBe(true);
  });

  it("requires at least one task on confirm", () => {
    expect(
      confirmExtractionSchema.safeParse({ tasks: [], risks: [] }).success,
    ).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
    expect(updateTaskSchema.safeParse({ status: "done" }).success).toBe(true);
  });

  it("rejects an invalid calendar date format", () => {
    expect(
      updateTaskSchema.safeParse({ dueDate: "2026/10/15" }).success,
    ).toBe(false);
  });
});
