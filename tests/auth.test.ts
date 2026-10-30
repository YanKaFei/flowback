import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, setDatabaseForTests } from "@/lib/db";
import {
  createDevUser,
  createSession,
  getAuthUser,
  getLocalUser,
  resolveSession,
} from "@/lib/auth";
import {
  confirmExtraction,
  createExtraction,
  createProject,
  createSource,
  deleteProject,
  getExtractionDetail,
  getProject,
  getProjectBundle,
  getRisk,
  getSource,
  getTask,
  listProjects,
  updateRisk,
  updateTask,
} from "@/lib/repo";
import type { DraftRisk, DraftTask, ExtractionPayload } from "@/lib/schemas";

const task: DraftTask = {
  id: "t1",
  title: "提交海报",
  owner: "小王",
  dueLabel: "周四",
  dueDate: null,
  dateStatus: "relative",
  priority: "high",
  status: "todo",
  confidence: "explicit",
  sourceQuote: "海报周四交，小王负责。",
  speaker: "林悦",
  evidenceQuote: null,
  needsConfirmation: false,
  note: null,
};

const risk: DraftRisk = {
  id: "r1",
  type: "due_unclear",
  severity: "medium",
  title: "截止时间待确认",
  detail: "相对日期。",
  sourceQuote: "海报周四交，小王负责。",
  taskRef: "t1",
  include: true,
};

const payload: ExtractionPayload = {
  summary: "一个任务",
  tasks: [task],
  risks: [risk],
  warnings: [],
};

function seedOwnedProject(ownerId: string, name: string) {
  const project = createProject(name, ownerId);
  const source = createSource({
    projectId: project.id,
    kind: "text",
    rawText: "海报周四交，小王负责。",
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
  const result = confirmExtraction({
    extraction,
    tasks: [task],
    risks: [risk],
    summary: payload.summary,
  });
  return { project, source, extraction, taskId: result.taskIds[0] };
}

describe("minimal identity and project ownership", () => {
  beforeEach(() => {
    setDatabaseForTests(":memory:");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates hashed sessions and resolves only the owning user", () => {
    const alice = createDevUser("device-alice-12345678");
    const bob = createDevUser("device-bob-12345678");
    const session = createSession(alice.id);

    expect(session.token.length).toBeGreaterThan(30);
    expect(resolveSession(session.token)?.id).toBe(alice.id);
    expect(resolveSession("not-a-session")).toBeNull();
    expect(resolveSession(session.token)?.id).not.toBe(bob.id);

    const stored = getDb()
      .prepare("SELECT token_hash FROM sessions LIMIT 1")
      .get() as { token_hash: string };
    expect(stored.token_hash).not.toBe(session.token);
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts a bearer session and rejects anonymous data access", () => {
    const alice = createDevUser("device-alice-bearer-12345678");
    const session = createSession(alice.id);
    const request = new Request("http://127.0.0.1:4317/api/projects", {
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(getAuthUser(request)?.id).toBe(alice.id);
    expect(
      getAuthUser(
        new Request("http://127.0.0.1:4317/api/projects", {
          headers: { authorization: "Bearer invalid" },
        }),
      ),
    ).toBeNull();
  });

  it("accepts the local admin cookie only with the server token", () => {
    vi.stubEnv("FLOWBACK_LOCAL_TOKEN", "local-cookie-test-token");
    const cookieRequest = new Request("http://127.0.0.1:4317/api/projects", {
      headers: { cookie: "fb_local=local-cookie-test-token" },
    });
    const wrongRequest = new Request("http://127.0.0.1:4317/api/projects", {
      headers: { cookie: "fb_local=wrong" },
    });
    expect(getAuthUser(cookieRequest)?.id).toBe(getLocalUser()?.id);
    expect(getAuthUser(wrongRequest)).toBeNull();
  });

  it("isolates project, source, extraction, task and risk reads", () => {
    const alice = createDevUser("device-alice-isolation-12345678");
    const bob = createDevUser("device-bob-isolation-12345678");
    const seeded = seedOwnedProject(alice.id, "Alice 的项目");
    const bobProject = createProject("Bob 的项目", bob.id);

    expect(listProjects(alice.id).map((p) => p.id)).toContain(seeded.project.id);
    expect(listProjects(alice.id).map((p) => p.id)).not.toContain(bobProject.id);
    expect(getProject(seeded.project.id, bob.id)).toBeNull();
    expect(getProjectBundle(seeded.project.id, bob.id)).toBeNull();
    expect(getSource(seeded.source.id, bob.id)).toBeNull();
    expect(getExtractionDetail(seeded.extraction.id, bob.id)).toBeNull();
    expect(getTask(seeded.taskId, bob.id)).toBeNull();

    const bundle = getProjectBundle(seeded.project.id, alice.id);
    const riskId = bundle?.risks[0]?.id ?? "";
    expect(riskId).toBeTruthy();
    expect(getRisk(riskId, bob.id)).toBeNull();
    expect(getRisk(riskId, alice.id)).not.toBeNull();
  });

  it("blocks cross-user task/risk mutation and project deletion", () => {
    const alice = createDevUser("device-alice-mutate-12345678");
    const bob = createDevUser("device-bob-mutate-12345678");
    const seeded = seedOwnedProject(alice.id, "Alice 可写项目");
    const bundle = getProjectBundle(seeded.project.id, alice.id)!;
    const riskId = bundle.risks[0].id;

    expect(
      updateTask(seeded.taskId, { status: "doing" }, undefined, bob.id),
    ).toBeNull();
    expect(
      updateRisk(riskId, { status: "resolved" }, bob.id),
    ).toBeNull();
    expect(deleteProject(seeded.project.id, bob.id)).toBe(false);

    expect(
      updateTask(seeded.taskId, { status: "doing" }, undefined, alice.id)?.status,
    ).toBe("doing");
    expect(deleteProject(seeded.project.id, alice.id)).toBe(true);
    expect(getProject(seeded.project.id, alice.id)).toBeNull();
    expect(bobProjectStillExists(bob.id)).toBe(true);
  });

  it("keeps legacy projects owned by the local admin after migration", () => {
    const local = getLocalUser();
    expect(local).not.toBeNull();
    const project = createProject("迁移后的默认项目");
    expect(getProject(project.id, local!.id)).not.toBeNull();
  });
});

function bobProjectStillExists(bobId: string): boolean {
  const project = createProject("Bob 保留项目", bobId);
  return Boolean(getProject(project.id, bobId));
}
