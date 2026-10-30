import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

export const PRIORITIES = ["high", "medium", "low"] as const;
export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export const CONFIDENCES = ["explicit", "inferred", "unconfirmed"] as const;
export const DATE_STATUSES = ["confirmed", "relative", "unknown"] as const;
export const RISK_TYPES = [
  "owner_gap",
  "due_conflict",
  "due_unclear",
  "decision_unconfirmed",
] as const;
export const RISK_STATUSES = ["open", "acknowledged", "resolved"] as const;
export const SEVERITIES = ["high", "medium", "low"] as const;
export const ANALYSIS_MODES = ["ai", "demo"] as const;

export type Priority = (typeof PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Confidence = (typeof CONFIDENCES)[number];
export type DateStatus = (typeof DATE_STATUSES)[number];
export type RiskType = (typeof RISK_TYPES)[number];
export type RiskStatus = (typeof RISK_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type AnalysisMode = (typeof ANALYSIS_MODES)[number];

export const prioritySchema = z.enum(PRIORITIES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
export const confidenceSchema = z.enum(CONFIDENCES);
export const dateStatusSchema = z.enum(DATE_STATUSES);
export const riskTypeSchema = z.enum(RISK_TYPES);
export const riskStatusSchema = z.enum(RISK_STATUSES);
export const severitySchema = z.enum(SEVERITIES);

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Draft payload (what the review screen edits, persisted as JSON)     */
/* ------------------------------------------------------------------ */

export const draftTaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().trim().min(1, "任务名称不能为空").max(120),
  owner: z.string().trim().max(40).nullable(),
  dueLabel: z.string().trim().max(40).nullable(),
  dueDate: z
    .string()
    .regex(ISO_DATE, "日期需为 YYYY-MM-DD")
    .nullable(),
  dateStatus: dateStatusSchema,
  priority: prioritySchema,
  status: taskStatusSchema,
  confidence: confidenceSchema,
  sourceQuote: z.string().trim().max(500),
  speaker: z.string().trim().max(40).nullable(),
  evidenceQuote: z.string().trim().max(300).nullable(),
  needsConfirmation: z.boolean(),
  note: z.string().trim().max(400).nullable(),
});

export type DraftTask = z.infer<typeof draftTaskSchema>;

export const draftRiskSchema = z.object({
  id: z.string().min(1).max(120),
  type: riskTypeSchema,
  severity: severitySchema,
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(400),
  sourceQuote: z.string().trim().max(500),
  taskRef: z.string().max(80).nullable(),
  include: z.boolean(),
});

export type DraftRisk = z.infer<typeof draftRiskSchema>;

export const extractionPayloadSchema = z.object({
  summary: z.string().max(1200),
  tasks: z.array(draftTaskSchema).max(30),
  risks: z.array(draftRiskSchema).max(30),
  warnings: z.array(z.string().max(300)).max(12),
});

export type ExtractionPayload = z.infer<typeof extractionPayloadSchema>;

export const confirmExtractionSchema = z.object({
  tasks: z.array(draftTaskSchema).min(1, "至少需要保留一个任务").max(30),
  risks: z.array(draftRiskSchema).max(30),
});

export type ConfirmExtractionInput = z.infer<typeof confirmExtractionSchema>;

/* ------------------------------------------------------------------ */
/* Analyze request                                                     */
/* ------------------------------------------------------------------ */

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 4;
export const MAX_TEXT_CHARS = 20_000;

export const imageInputSchema = z.object({
  name: z.string().trim().max(120).default("screenshot"),
  mime: z.enum(ALLOWED_IMAGE_MIME),
  dataUrl: z
    .string()
    .max(8_000_000, "图片过大")
    .regex(/^data:image\/(jpeg|png|webp);base64,/, "图片格式必须是 JPEG/PNG/WebP"),
});

export type ImageInput = z.infer<typeof imageInputSchema>;

export const analyzeRequestSchema = z
  .object({
    projectId: z.string().trim().max(80).nullish(),
    projectName: z.string().trim().max(60).nullish(),
    text: z.string().max(MAX_TEXT_CHARS, "文本超出 20000 字上限").default(""),
    images: z.array(imageInputSchema).max(MAX_IMAGES, "最多上传 4 张截图").default([]),
  })
  .refine((v) => v.text.trim().length > 0 || v.images.length > 0, {
    message: "请粘贴聊天文字或上传截图",
    path: ["text"],
  });

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/* ------------------------------------------------------------------ */
/* DeepSeek wire format (snake_case, validated before use)             */
/* ------------------------------------------------------------------ */

const nullishString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" ? v.trim() : null));

const aiTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  owner: nullishString,
  due_label: nullishString,
  due_date: nullishString,
  date_status: z.enum(DATE_STATUSES).optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("todo"),
  confidence: z.enum(CONFIDENCES).default("inferred"),
  source_quote: z.string().trim().max(500).default(""),
  speaker: nullishString,
  evidence_quote: nullishString,
  needs_confirmation: z.boolean().optional(),
  note: nullishString,
});

export type AiTask = z.infer<typeof aiTaskSchema>;

const aiRiskSchema = z.object({
  type: riskTypeSchema,
  task_index: z.number().int().min(1).max(30).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(400).default(""),
  source_quote: z.string().trim().max(500).default(""),
  severity: z.enum(SEVERITIES).default("medium"),
});

export type AiRisk = z.infer<typeof aiRiskSchema>;

const aiTranscript = z
  .union([z.string().max(4000), z.null()])
  .optional()
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const aiExtractionSchema = z.object({
  project_name: nullishString,
  transcript: aiTranscript,
  summary: z.string().trim().max(1200).default(""),
  tasks: z.array(aiTaskSchema).max(30).default([]),
  risks: z.array(aiRiskSchema).max(30).default([]),
  warnings: z.array(z.string().trim().max(300)).max(12).default([]),
});

export type AiExtraction = z.infer<typeof aiExtractionSchema>;

/* ------------------------------------------------------------------ */
/* API payloads                                                        */
/* ------------------------------------------------------------------ */

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    owner: z.string().trim().max(40).nullable().optional(),
    dueLabel: z.string().trim().max(40).nullable().optional(),
    dueDate: z.string().regex(ISO_DATE).nullable().optional(),
    dateStatus: dateStatusSchema.optional(),
    priority: prioritySchema.optional(),
    status: taskStatusSchema.optional(),
    note: z.string().trim().max(400).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "没有可更新的字段" });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateRiskSchema = z.object({
  status: riskStatusSchema.optional(),
  note: z.string().trim().max(400).nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  detail: z.string().trim().max(400).optional(),
});

export const saveDraftSchema = z.object({
  tasks: z.array(draftTaskSchema).max(30),
  risks: z.array(draftRiskSchema).max(30),
  summary: z.string().max(1200).optional(),
});

export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
