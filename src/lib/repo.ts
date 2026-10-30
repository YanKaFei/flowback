import fs from "node:fs";
import path from "node:path";
import { AUTH_LOCAL_USER_ID, DATA_DIR, UPLOAD_DIR, getDb, transaction } from "./db";
import {
  extractionPayloadSchema,
  type DraftRisk,
  type DraftTask,
  type ExtractionPayload,
  type RiskStatus,
  type RiskType,
  type Severity,
  type TaskStatus,
  type Priority,
  type Confidence,
  type DateStatus,
  type AnalysisMode,
} from "./schemas";
import { newId, nowIso } from "./utils";

export interface StoredImage {
  path: string; // relative to DATA_DIR
  name: string;
  mime: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  doneCount: number;
  openRiskCount: number;
  sourceCount: number;
}

export interface SourceRecord {
  id: string;
  projectId: string;
  kind: "text" | "image" | "mixed";
  rawText: string;
  images: StoredImage[];
  fileNames: string[];
  mode: AnalysisMode;
  model: string | null;
  createdAt: string;
}

export interface ExtractionRecord {
  id: string;
  sourceId: string;
  projectId: string;
  status: "draft" | "confirmed";
  summary: string;
  payload: ExtractionPayload;
  mode: AnalysisMode;
  model: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  sourceId: string;
  extractionId: string | null;
  title: string;
  owner: string | null;
  dueLabel: string | null;
  dueDate: string | null;
  dateStatus: DateStatus;
  priority: Priority;
  status: TaskStatus;
  confidence: Confidence;
  sourceQuote: string;
  speaker: string | null;
  evidenceQuote: string | null;
  needsConfirmation: boolean;
  note: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RiskRecord {
  id: string;
  projectId: string;
  taskId: string | null;
  sourceId: string;
  extractionId: string | null;
  type: RiskType;
  severity: Severity;
  status: RiskStatus;
  title: string;
  detail: string;
  sourceQuote: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEventRecord {
  id: string;
  taskId: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
}

export interface ProjectBundle {
  project: ProjectSummary;
  sources: SourceRecord[];
  extractions: ExtractionRecord[];
  tasks: TaskRecord[];
  risks: RiskRecord[];
  events: TaskEventRecord[];
}

type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapProject(row: Row): ProjectSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    taskCount: num(row.task_count),
    doneCount: num(row.done_count),
    openRiskCount: num(row.open_risk_count),
    sourceCount: num(row.source_count),
  };
}

function mapSource(row: Row): SourceRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: row.kind as SourceRecord["kind"],
    rawText: String(row.raw_text ?? ""),
    images: parseJson<StoredImage[]>(row.images_json, []),
    fileNames: parseJson<string[]>(row.file_names_json, []),
    mode: row.mode as AnalysisMode,
    model: str(row.model),
    createdAt: String(row.created_at),
  };
}

function mapExtraction(row: Row): ExtractionRecord {
  const parsed = extractionPayloadSchema.safeParse(
    parseJson<unknown>(row.payload_json, null),
  );
  const payload: ExtractionPayload = parsed.success
    ? parsed.data
    : { summary: "", tasks: [], risks: [], warnings: [] };
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    projectId: String(row.project_id),
    status: row.status as "draft" | "confirmed",
    summary: String(row.summary ?? payload.summary ?? ""),
    payload,
    mode: row.mode as AnalysisMode,
    model: str(row.model),
    warnings: parseJson<string[]>(row.warnings_json, []),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapTask(row: Row): TaskRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sourceId: String(row.source_id),
    extractionId: str(row.extraction_id),
    title: String(row.title),
    owner: str(row.owner),
    dueLabel: str(row.due_label),
    dueDate: str(row.due_date),
    dateStatus: row.date_status as DateStatus,
    priority: row.priority as Priority,
    status: row.status as TaskStatus,
    confidence: row.confidence as Confidence,
    sourceQuote: String(row.source_quote ?? ""),
    speaker: str(row.speaker),
    evidenceQuote: str(row.evidence_quote),
    needsConfirmation: num(row.needs_confirmation) === 1,
    note: str(row.note),
    sortOrder: num(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapRisk(row: Row): RiskRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    taskId: str(row.task_id),
    sourceId: String(row.source_id),
    extractionId: str(row.extraction_id),
    type: row.type as RiskType,
    severity: row.severity as Severity,
    status: row.status as RiskStatus,
    title: String(row.title),
    detail: String(row.detail ?? ""),
    sourceQuote: String(row.source_quote ?? ""),
    resolutionNote: str(row.resolution_note),
    resolvedAt: str(row.resolved_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapEvent(row: Row): TaskEventRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    type: String(row.type),
    fromValue: str(row.from_value),
    toValue: str(row.to_value),
    note: str(row.note),
    createdAt: String(row.created_at),
  };
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_count,
    (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id AND r.status != 'resolved') AS open_risk_count,
    (SELECT COUNT(*) FROM sources s WHERE s.project_id = p.id) AS source_count
  FROM projects p
`;

export function listProjects(ownerId?: string): ProjectSummary[] {
  const rows = ownerId
    ? (getDb()
        .prepare(
          `${PROJECT_SELECT} WHERE p.owner_id = ? ORDER BY p.updated_at DESC`,
        )
        .all(ownerId) as Row[])
    : (getDb()
        .prepare(`${PROJECT_SELECT} ORDER BY p.updated_at DESC`)
        .all() as Row[]);
  return rows.map(mapProject);
}

export function getProject(
  id: string,
  ownerId?: string,
): ProjectSummary | null {
  const row = ownerId
    ? (getDb()
        .prepare(`${PROJECT_SELECT} WHERE p.id = ? AND p.owner_id = ?`)
        .get(id, ownerId) as Row | undefined)
    : (getDb()
        .prepare(`${PROJECT_SELECT} WHERE p.id = ?`)
        .get(id) as Row | undefined);
  return row ? mapProject(row) : null;
}

export function createProject(
  name: string,
  ownerId = AUTH_LOCAL_USER_ID,
): ProjectSummary {
  const id = newId("prj");
  const now = nowIso();
  const clean = name.trim().slice(0, 60) || "未命名项目";
  getDb()
    .prepare(
      "INSERT INTO projects (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, clean, ownerId, now, now);
  return {
    id,
    name: clean,
    createdAt: now,
    updatedAt: now,
    taskCount: 0,
    doneCount: 0,
    openRiskCount: 0,
    sourceCount: 0,
  };
}

export function touchProject(id: string): void {
  getDb()
    .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
}

/* ------------------------------------------------------------------ */
/* Sources & extractions                                               */
/* ------------------------------------------------------------------ */

export function createSource(input: {
  id?: string;
  projectId: string;
  kind: SourceRecord["kind"];
  rawText: string;
  images: StoredImage[];
  fileNames: string[];
  mode: AnalysisMode;
  model: string | null;
}): SourceRecord {
  const id = input.id ?? newId("src");
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO sources
        (id, project_id, kind, raw_text, images_json, file_names_json, mode, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.projectId,
      input.kind,
      input.rawText,
      JSON.stringify(input.images),
      JSON.stringify(input.fileNames),
      input.mode,
      input.model,
      now,
    );
  return {
    id,
    projectId: input.projectId,
    kind: input.kind,
    rawText: input.rawText,
    images: input.images,
    fileNames: input.fileNames,
    mode: input.mode,
    model: input.model,
    createdAt: now,
  };
}

export function getSource(id: string, ownerId?: string): SourceRecord | null {
  const row = ownerId
    ? (getDb()
        .prepare(
          `SELECT s.* FROM sources s
           JOIN projects p ON p.id = s.project_id
           WHERE s.id = ? AND p.owner_id = ?`,
        )
        .get(id, ownerId) as Row | undefined)
    : (getDb()
        .prepare("SELECT * FROM sources WHERE id = ?")
        .get(id) as Row | undefined);
  return row ? mapSource(row) : null;
}

export function createExtraction(input: {
  sourceId: string;
  projectId: string;
  payload: ExtractionPayload;
  mode: AnalysisMode;
  model: string | null;
  warnings: string[];
}): ExtractionRecord {
  const id = newId("ext");
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO extractions
        (id, source_id, project_id, status, summary, payload_json, mode, model, warnings_json, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.sourceId,
      input.projectId,
      input.payload.summary,
      JSON.stringify(input.payload),
      input.mode,
      input.model,
      JSON.stringify(input.warnings),
      now,
      now,
    );
  return {
    id,
    sourceId: input.sourceId,
    projectId: input.projectId,
    status: "draft",
    summary: input.payload.summary,
    payload: input.payload,
    mode: input.mode,
    model: input.model,
    warnings: input.warnings,
    createdAt: now,
    updatedAt: now,
  };
}

export function getExtraction(id: string): ExtractionRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM extractions WHERE id = ?")
    .get(id) as Row | undefined;
  return row ? mapExtraction(row) : null;
}

export function getExtractionDetail(id: string, ownerId?: string): {
  extraction: ExtractionRecord;
  source: SourceRecord;
  project: ProjectSummary;
} | null {
  const extraction = getExtraction(id);
  if (!extraction) return null;
  const source = getSource(extraction.sourceId, ownerId);
  const project = getProject(extraction.projectId, ownerId);
  if (!source || !project) return null;
  return { extraction, source, project };
}

export function saveExtractionDraft(
  id: string,
  payload: ExtractionPayload,
): ExtractionRecord | null {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE extractions
       SET payload_json = ?, summary = ?, warnings_json = ?, updated_at = ?
       WHERE id = ? AND status = 'draft'`,
    )
    .run(
      JSON.stringify(payload),
      payload.summary,
      JSON.stringify(payload.warnings),
      now,
      id,
    );
  const owner = getDb()
    .prepare("SELECT project_id FROM extractions WHERE id = ?")
    .get(id) as Row | undefined;
  if (owner?.project_id) {
    touchProject(String(owner.project_id));
  }
  return getExtraction(id);
}

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

export function confirmExtraction(input: {
  extraction: ExtractionRecord;
  tasks: DraftTask[];
  risks: DraftRisk[];
  summary: string;
}): { projectId: string; taskIds: string[] } {
  const { extraction, tasks, risks, summary } = input;
  const now = nowIso();
  const taskIds: string[] = [];
  const idByDraft = new Map<string, string>();

  transaction(() => {
    tasks.forEach((task, index) => {
      const id = newId("task");
      taskIds.push(id);
      idByDraft.set(task.id, id);
      getDb()
        .prepare(
          `INSERT INTO tasks
            (id, project_id, source_id, extraction_id, title, owner, due_label, due_date,
             date_status, priority, status, confidence, source_quote, speaker, evidence_quote,
             needs_confirmation, note, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          extraction.projectId,
          extraction.sourceId,
          extraction.id,
          task.title,
          task.owner,
          task.dueLabel,
          task.dueDate,
          task.dateStatus,
          task.priority,
          task.status,
          task.confidence,
          task.sourceQuote,
          task.speaker,
          task.evidenceQuote,
          task.needsConfirmation ? 1 : 0,
          task.note,
          index,
          now,
          now,
        );
      getDb()
        .prepare(
          `INSERT INTO task_events (id, task_id, type, from_value, to_value, note, created_at)
           VALUES (?, ?, 'created', NULL, ?, '审核后写入任务', ?)`,
        )
        .run(newId("evt"), id, task.status, now);
    });

    for (const risk of risks) {
      const taskId = risk.taskRef ? idByDraft.get(risk.taskRef) ?? null : null;
      getDb()
        .prepare(
          `INSERT INTO risks
            (id, project_id, task_id, source_id, extraction_id, type, severity, status,
             title, detail, source_quote, resolution_note, resolved_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, NULL, ?, ?)`,
        )
        .run(
          newId("risk"),
          extraction.projectId,
          taskId,
          extraction.sourceId,
          extraction.id,
          risk.type,
          risk.severity,
          risk.title,
          risk.detail,
          risk.sourceQuote,
          now,
          now,
        );
    }

    getDb()
      .prepare(
        `UPDATE extractions
         SET status = 'confirmed', summary = ?, payload_json = ?, warnings_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        summary,
        JSON.stringify({ ...extraction.payload, summary, tasks, risks: risks.filter((r) => r.include) }),
        JSON.stringify(extraction.warnings),
        now,
        extraction.id,
      );

    getDb()
      .prepare("UPDATE projects SET updated_at = ? WHERE id = ?")
      .run(now, extraction.projectId);
  });

  return { projectId: extraction.projectId, taskIds };
}

/* ------------------------------------------------------------------ */
/* Deletion                                                            */
/* ------------------------------------------------------------------ */

export function deleteProject(id: string, ownerId?: string): boolean {
  const project = getProject(id, ownerId);
  if (!project) return false;
  const db = getDb();
  const sources = db
    .prepare("SELECT id FROM sources WHERE project_id = ?")
    .all(id) as Row[];
  transaction(() => {
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });
  for (const source of sources) {
    try {
      fs.rmSync(path.join(UPLOAD_DIR, String(source.id)), {
        recursive: true,
        force: true,
      });
    } catch {
      // The DB row is gone; a leftover temp file must not block deletion.
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Project bundle                                                      */
/* ------------------------------------------------------------------ */

export function getProjectBundle(
  projectId: string,
  ownerId?: string,
): ProjectBundle | null {
  const project = getProject(projectId, ownerId);
  if (!project) return null;

  const db = getDb();
  const sources = (
    db
      .prepare("SELECT * FROM sources WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Row[]
  ).map(mapSource);
  const extractions = (
    db
      .prepare(
        "SELECT * FROM extractions WHERE project_id = ? ORDER BY created_at DESC",
      )
      .all(projectId) as Row[]
  ).map(mapExtraction);
  const tasks = (
    db
      .prepare(
        "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC",
      )
      .all(projectId) as Row[]
  ).map(mapTask);
  const risks = (
    db
      .prepare(
        `SELECT * FROM risks WHERE project_id = ?
         ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
                  CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  created_at ASC`,
      )
      .all(projectId) as Row[]
  ).map(mapRisk);
  const events = (
    db
      .prepare(
        `SELECT e.* FROM task_events e
         JOIN tasks t ON t.id = e.task_id
         WHERE t.project_id = ?
         ORDER BY e.created_at DESC LIMIT 80`,
      )
      .all(projectId) as Row[]
  ).map(mapEvent);

  return { project, sources, extractions, tasks, risks, events };
}

export function getTask(id: string, ownerId?: string): TaskRecord | null {
  const row = ownerId
    ? (getDb()
        .prepare(
          `SELECT t.* FROM tasks t
           JOIN projects p ON p.id = t.project_id
           WHERE t.id = ? AND p.owner_id = ?`,
        )
        .get(id, ownerId) as Row | undefined)
    : (getDb()
        .prepare("SELECT * FROM tasks WHERE id = ?")
        .get(id) as Row | undefined);
  return row ? mapTask(row) : null;
}

export function getTaskEvents(taskId: string): TaskEventRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC")
    .all(taskId) as Row[];
  return rows.map(mapEvent);
}

/* ------------------------------------------------------------------ */
/* Task updates                                                        */
/* ------------------------------------------------------------------ */

const TASK_COLUMNS: Record<string, string> = {
  title: "title",
  owner: "owner",
  dueLabel: "due_label",
  dueDate: "due_date",
  dateStatus: "date_status",
  priority: "priority",
  status: "status",
  note: "note",
};

const FIELD_LABELS: Record<string, string> = {
  title: "任务名称",
  owner: "负责人",
  dueLabel: "截止时间",
  dueDate: "具体日期",
  dateStatus: "日期状态",
  priority: "优先级",
  status: "状态",
  note: "备注",
};

export function updateTask(
  id: string,
  patch: Record<string, string | null | undefined>,
  note?: string | null,
  ownerId?: string,
): TaskRecord | null {
  const existing = getTask(id, ownerId);
  if (!existing) return null;

  const fields: Record<string, string | null> = {};
  for (const [key, column] of Object.entries(TASK_COLUMNS)) {
    if (patch[key] !== undefined) {
      fields[column] = patch[key] ?? null;
    }
  }

  if (patch.dueDate !== undefined || patch.dueLabel !== undefined) {
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : existing.dueDate;
    const dueLabel =
      patch.dueLabel !== undefined ? patch.dueLabel : existing.dueLabel;
    fields.date_status = dueDate
      ? "confirmed"
      : dueLabel
        ? "relative"
        : "unknown";
  }

  if (Object.keys(fields).length === 0) return existing;

  const now = nowIso();
  const assignments = Object.keys(fields)
    .map((col) => `${col} = ?`)
    .join(", ");
  getDb()
    .prepare(`UPDATE tasks SET ${assignments}, updated_at = ? WHERE id = ?`)
    .run(...Object.values(fields), now, id);

  const changed = Object.keys(fields)
    .map((col) => {
      const key = Object.keys(TASK_COLUMNS).find(
        (k) => TASK_COLUMNS[k] === col,
      );
      return key ? FIELD_LABELS[key] ?? key : col;
    })
    .filter(Boolean);

  if (patch.status !== undefined && patch.status !== existing.status) {
    getDb()
      .prepare(
        `INSERT INTO task_events (id, task_id, type, from_value, to_value, note, created_at)
         VALUES (?, ?, 'status_changed', ?, ?, ?, ?)`,
      )
      .run(
        newId("evt"),
        id,
        existing.status,
        patch.status,
        note ?? null,
        now,
      );
  } else if (changed.length > 0) {
    getDb()
      .prepare(
        `INSERT INTO task_events (id, task_id, type, from_value, to_value, note, created_at)
         VALUES (?, ?, 'updated', NULL, NULL, ?, ?)`,
      )
      .run(newId("evt"), id, `修改了${changed.join("、")}`, now);
  }

  // A fixed field closes its directly-linked structural risk automatically.
  if (patch.owner !== undefined && patch.owner !== null && patch.owner.trim()) {
    getDb()
      .prepare(
        `UPDATE risks SET status = 'resolved', resolution_note = ?, resolved_at = ?, updated_at = ?
         WHERE task_id = ? AND type = 'owner_gap' AND status != 'resolved'`,
      )
      .run("负责人已补全（系统自动解除）", now, now, id);
  }
  if (patch.dueDate !== undefined && patch.dueDate) {
    getDb()
      .prepare(
        `UPDATE risks SET status = 'resolved', resolution_note = ?, resolved_at = ?, updated_at = ?
         WHERE task_id = ? AND type = 'due_unclear' AND status != 'resolved'`,
      )
      .run("截止时间已补全（系统自动解除）", now, now, id);
  }

  // Clearing a previously fixed field re-opens the matching structural risk,
  // so the board never hides a newly created gap.
  const fresh = getTask(id, ownerId);
  if (fresh && fresh.status !== "done") {
    if (patch.owner !== undefined && !fresh.owner) {
      ensureStructuralRisk(fresh, "owner_gap", now);
    }
    if (
      (patch.dueDate !== undefined || patch.dueLabel !== undefined) &&
      !fresh.dueDate &&
      !fresh.dueLabel
    ) {
      ensureStructuralRisk(fresh, "due_unclear", now);
    }
  }

  touchProject(existing.projectId);
  return getTask(id, ownerId);
}


function ensureStructuralRisk(
  task: TaskRecord,
  type: "owner_gap" | "due_unclear",
  now: string,
): void {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id FROM risks WHERE task_id = ? AND type = ? AND status != 'resolved' LIMIT 1`,
    )
    .get(task.id, type);
  if (existing) return;

  const ownerGap = type === "owner_gap";
  db.prepare(
    `INSERT INTO risks
      (id, project_id, task_id, source_id, extraction_id, type, severity, status,
       title, detail, source_quote, resolution_note, resolved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, NULL, NULL, ?, ?)`,
  ).run(
    newId("risk"),
    task.projectId,
    task.id,
    task.sourceId,
    task.extractionId,
    type,
    ownerGap ? "high" : "medium",
    ownerGap
      ? `「${task.title}」无人负责`
      : `「${task.title}」缺少截止时间`,
    ownerGap
      ? "负责人被清空，任务重新变为无人负责，请指派负责人。"
      : "截止时间被清空，需要补充明确日期。",
    task.sourceQuote,
    now,
    now,
  );
}

/* ------------------------------------------------------------------ */
/* Risk updates                                                        */
/* ------------------------------------------------------------------ */

export function getRisk(id: string, ownerId?: string): RiskRecord | null {
  const row = ownerId
    ? (getDb()
        .prepare(
          `SELECT r.* FROM risks r
           JOIN projects p ON p.id = r.project_id
           WHERE r.id = ? AND p.owner_id = ?`,
        )
        .get(id, ownerId) as Row | undefined)
    : (getDb()
        .prepare("SELECT * FROM risks WHERE id = ?")
        .get(id) as Row | undefined);
  return row ? mapRisk(row) : null;
}

export function updateRisk(
  id: string,
  patch: {
    status?: RiskStatus;
    note?: string | null;
    title?: string;
    detail?: string;
  },
  ownerId?: string,
): RiskRecord | null {
  const existing = getRisk(id, ownerId);
  if (!existing) return null;

  const now = nowIso();
  const assignments: string[] = [];
  const values: (string | null)[] = [];

  if (patch.status) {
    assignments.push("status = ?");
    values.push(patch.status);
    if (patch.status === "resolved") {
      assignments.push("resolved_at = ?");
      values.push(now);
    } else {
      assignments.push("resolved_at = NULL");
    }
    if (patch.status === "open") {
      assignments.push("resolution_note = NULL");
    }
  }
  if (patch.note !== undefined) {
    assignments.push("resolution_note = ?");
    values.push(patch.note);
  }
  if (patch.title !== undefined) {
    assignments.push("title = ?");
    values.push(patch.title);
  }
  if (patch.detail !== undefined) {
    assignments.push("detail = ?");
    values.push(patch.detail);
  }

  if (assignments.length === 0) return existing;
  assignments.push("updated_at = ?");
  values.push(now);

  getDb()
    .prepare(`UPDATE risks SET ${assignments.join(", ")} WHERE id = ?`)
    .run(...values, id);
  touchProject(existing.projectId);
  return getRisk(id, ownerId);
}
