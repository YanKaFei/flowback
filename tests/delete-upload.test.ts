import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UPLOAD_DIR, setDatabaseForTests } from "@/lib/db";
import { createDevUser } from "@/lib/auth";
import { createProject, createSource, deleteProject } from "@/lib/repo";

const projectIds: string[] = [];

describe("project deletion removes stored screenshots", () => {
  beforeEach(() => {
    setDatabaseForTests(":memory:");
  });

  afterEach(() => {
    for (const id of projectIds.splice(0)) {
      try {
        fs.rmSync(path.join(UPLOAD_DIR, id), { recursive: true, force: true });
      } catch {
        // Best-effort test cleanup.
      }
    }
  });

  it("deletes only the owner's source directory and leaves another owner intact", () => {
    const alice = createDevUser("device-delete-files-alice-12345678");
    const bob = createDevUser("device-delete-files-bob-12345678");
    const aliceProject = createProject("Alice 文件项目", alice.id);
    const bobProject = createProject("Bob 文件项目", bob.id);
    projectIds.push(aliceProject.id, bobProject.id);

    const aliceSource = createSource({
      projectId: aliceProject.id,
      kind: "image",
      rawText: "",
      images: [{ path: "uploads/temp/0.png", name: "chat.png", mime: "image/png" }],
      fileNames: ["chat.png"],
      mode: "demo",
      model: null,
    });
    const bobSource = createSource({
      projectId: bobProject.id,
      kind: "image",
      rawText: "",
      images: [{ path: "uploads/temp/0.png", name: "chat.png", mime: "image/png" }],
      fileNames: ["chat.png"],
      mode: "demo",
      model: null,
    });
    const aliceDir = path.join(UPLOAD_DIR, aliceSource.id);
    const bobDir = path.join(UPLOAD_DIR, bobSource.id);
    fs.mkdirSync(aliceDir, { recursive: true });
    fs.mkdirSync(bobDir, { recursive: true });
    fs.writeFileSync(path.join(aliceDir, "0.png"), "alice");
    fs.writeFileSync(path.join(bobDir, "0.png"), "bob");

    expect(deleteProject(aliceProject.id, alice.id)).toBe(true);
    expect(fs.existsSync(aliceDir)).toBe(false);
    expect(fs.existsSync(bobDir)).toBe(true);
    expect(deleteProject(bobProject.id, alice.id)).toBe(false);
    expect(fs.existsSync(bobDir)).toBe(true);
  });
});
