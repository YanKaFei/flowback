import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiConfig } from "@/lib/deepseek";
import { readStoredImage } from "@/lib/uploads";
import { redactForLog } from "@/lib/log";

const ROOT = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("secret and review-boundary security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gitignores local env files and never ships a real key", () => {
    const ignoreLines = read(".gitignore").split(/\r?\n/).map((line) => line.trim());
    expect(ignoreLines).toContain(".env.local");
    expect(ignoreLines).toContain(".env");
    expect(read(".env.example")).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
  });

  it("does not expose the key through the safe AI config", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-this-must-not-leak-123456");
    const config = getAiConfig();
    expect(config.configured).toBe(true);
    expect(config.thinking).toBe("disabled");
    expect(JSON.stringify(config)).not.toContain("sk-this-must-not-leak");
    expect(Object.keys(config)).not.toContain("apiKey");
  });

  it("keeps AI and DB modules out of client components", () => {
    for (const file of walk(path.join(ROOT, "src", "components"))) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.startsWith('"use client"')) continue;
      expect(source).not.toMatch(/from\s+["']@\/lib\/(deepseek|db)["']/);
      for (const line of source.split(/\r?\n/)) {
        if (line.includes('@/lib/repo')) {
          expect(line.trim().startsWith("import type")).toBe(true);
        }
      }
    }
  });

  it("keeps analysis and confirmation as separate API steps", () => {
    const route = read("src/app/api/analyze/route.ts");
    expect(route).not.toContain("confirmExtraction");
    expect(route).not.toContain("INSERT INTO tasks");
    expect(route).not.toContain("INSERT INTO risks");
  });

  it("does not log raw chat content to the console", () => {
    for (const file of walk(path.join(ROOT, "src"))) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toContain("console.log(");
    }
  });

  it("blocks path traversal when serving stored screenshots", async () => {
    expect(await readStoredImage("../.env.local")).toBeNull();
    expect(await readStoredImage("../../etc/passwd")).toBeNull();
    expect(await readStoredImage("/etc/passwd")).toBeNull();
    expect(await readStoredImage("uploads/../../package.json")).toBeNull();
  });

  it("redacts credentials, bearer tokens and inline images from logs", () => {
    const raw =
      "failed key=sk-this-is-a-long-secret-123456 data:image/png;base64,AAAA" +
      " Authorization: Bearer abc.def.ghi code=wx-code-123 openid=o123";
    const clean = redactForLog(raw);
    expect(clean).not.toContain("sk-this-is-a-long-secret");
    expect(clean).not.toContain("data:image/png;base64");
    expect(clean).not.toContain("abc.def.ghi");
    expect(clean).not.toContain("wx-code-123");
    expect(clean).not.toContain("o123");
  });

  it("health endpoint never reads or returns the key", () => {
    const route = read("src/app/api/health/route.ts");
    expect(route).not.toContain("DEEPSEEK_API_KEY");
    expect(route).not.toContain("Authorization");
  });
});
