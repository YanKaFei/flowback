import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ACCEPT = path.join(ROOT, "acceptance");
const VALID_RISKS = new Set([
  "owner_gap",
  "due_conflict",
  "due_unclear",
  "decision_unconfirmed",
]);

interface ExpectedTask {
  required?: boolean;
  matchAny: string[];
  owner?: string | null;
  dueAny?: string[];
  status?: string;
}

interface Fixture {
  id: string;
  label: string;
  kind: "text" | "image";
  projectName: string;
  text?: string;
  transcript?: string;
  images?: string[];
  expected: {
    taskCount: { min: number; max: number };
    tasks: ExpectedTask[];
    requiredRiskTypes?: string[];
    allowedRiskTypes?: string[];
  };
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(ACCEPT, "fixtures.json"), "utf8"),
) as { fixtures: Fixture[] };

describe("R1 acceptance fixtures", () => {
  it("has at least five independent fixtures, including two PNG screenshots", () => {
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(5);
    const imageFixtures = manifest.fixtures.filter((f) => f.kind === "image");
    expect(imageFixtures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(manifest.fixtures.map((f) => f.id)).size).toBe(
      manifest.fixtures.length,
    );
  });

  it("keeps fixture declarations valid and cleanup-safe", () => {
    for (const fixture of manifest.fixtures) {
      expect(fixture.id).toMatch(/^[0-9]{2}-/);
      expect(fixture.projectName.startsWith("AI验收")).toBe(true);
      expect(fixture.expected.taskCount.min).toBeLessThanOrEqual(
        fixture.expected.taskCount.max,
      );
      expect(Array.isArray(fixture.expected.tasks)).toBe(true);
      for (const task of fixture.expected.tasks) {
        expect(Array.isArray(task.matchAny)).toBe(true);
        expect(task.matchAny.length).toBeGreaterThan(0);
      }
      for (const type of [
        ...(fixture.expected.requiredRiskTypes ?? []),
        ...(fixture.expected.allowedRiskTypes ?? []),
      ]) {
        expect(VALID_RISKS.has(type)).toBe(true);
      }
      expect(JSON.stringify(fixture)).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    }
  });

  it("contains real PNG files within the upload limit", () => {
    for (const fixture of manifest.fixtures.filter((f) => f.kind === "image")) {
      expect(fixture.images?.length).toBeGreaterThan(0);
      expect(fixture.transcript?.trim().length).toBeGreaterThan(20);
      for (const relativePath of fixture.images ?? []) {
        const absolute = path.join(ACCEPT, relativePath);
        expect(fs.existsSync(absolute)).toBe(true);
        const buffer = fs.readFileSync(absolute);
        expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(buffer.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024);
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        expect(width).toBeGreaterThanOrEqual(320);
        expect(height).toBeGreaterThanOrEqual(240);
      }
    }
  });

  it("keeps chitchat as a zero-task fixture", () => {
    const chitchat = manifest.fixtures.find((f) => f.id === "05-chitchat-text");
    expect(chitchat).toBeDefined();
    expect(chitchat?.expected.taskCount).toEqual({ min: 0, max: 0 });
    expect(chitchat?.expected.tasks).toHaveLength(0);
    expect(chitchat?.expected.requiredRiskTypes).toEqual([]);
  });
});
