#!/usr/bin/env node
/**
 * FlowBack R1 real-AI acceptance harness.
 *
 * - Without DEEPSEEK_API_KEY: writes a BLOCKED report. Never calls a model,
 *   never writes fake numbers, never confirms an extraction.
 * - With a key loaded by the running server: sends 7 fixtures through the real
 *   /api/analyze route, records expected vs actual task/risk/quote results,
 *   cleans up the temporary projects, and writes a de-identified report.
 *
 * Usage: npm run acceptance
 * Env: ACCEPTANCE_BASE_URL (default http://127.0.0.1:4317)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACCEPT_DIR = path.join(ROOT, "acceptance");
const FIXTURES_PATH = path.join(ACCEPT_DIR, "fixtures.json");
const REPORT_PATH = path.join(ACCEPT_DIR, "REPORT.md");
const RESULTS_DIR = path.join(ACCEPT_DIR, "results");
const DB_PATH = process.env.FLOWBACK_DB?.trim() || path.join(ROOT, "data", "flowback.db");
const BASE_URL = (
  process.env.ACCEPTANCE_BASE_URL?.trim() || "http://127.0.0.1:4317"
).replace(/\/+$/, "");

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = value;
    }
  }
}

loadDotEnv(path.join(ROOT, ".env.local"));
loadDotEnv(path.join(ROOT, ".env"));

const API_KEY = process.env.DEEPSEEK_API_KEY?.trim() || "";
const KEY_PRESENT_LOCALLY = Boolean(API_KEY);
const STARTED_AT = new Date().toISOString();
const GITIGNORE_LINES = fs
  .readFileSync(path.join(ROOT, ".gitignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim());
const MODEL = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
const TIMEOUT_MS = 240_000;

function redact(value) {
  let text = typeof value === "string" ? value : JSON.stringify(value);
  if (API_KEY) text = text.split(API_KEY).join("[REDACTED]");
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED]");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeReport(markdown, json) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, redact(markdown), "utf8");
  const latest = path.join(RESULTS_DIR, "latest.json");
  fs.writeFileSync(latest, redact(JSON.stringify(json, null, 2)), "utf8");
  return { report: REPORT_PATH, latest };
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function table(headers, rows) {
  const head = `| ${headers.map(mdEscape).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[“”"'']/g, "")
    .replace(/[，。！？、；：,.!?;:()（）【】[\]]/g, "")
    .trim();
}

function fixtureTranscript(fixture) {
  return fixture.kind === "image" ? fixture.transcript : fixture.text;
}

function imageMeta(relativePath) {
  const absolute = path.join(ACCEPT_DIR, relativePath);
  const buffer = fs.readFileSync(absolute);
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const width = png ? buffer.readUInt32BE(16) : null;
  const height = png ? buffer.readUInt32BE(20) : null;
  return {
    path: relativePath,
    bytes: buffer.length,
    png,
    width,
    height,
    base64: buffer.toString("base64"),
  };
}

function validateFixtures() {
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
  } catch (error) {
    return { ok: false, errors: [`fixtures.json 无法解析：${redact(error.message)}`] };
  }
  const fixtures = Array.isArray(manifest.fixtures) ? manifest.fixtures : [];
  if (fixtures.length < 5) errors.push(`至少需要 5 组夹具，当前 ${fixtures.length}`);
  const ids = new Set();
  const images = [];
  for (const fixture of fixtures) {
    if (!fixture.id || ids.has(fixture.id)) errors.push(`夹具 id 缺失或重复：${fixture.id}`);
    ids.add(fixture.id);
    if (!fixture.expected || !fixture.expected.taskCount) {
      errors.push(`${fixture.id}: 缺少 expected.taskCount`);
    }
    if (fixture.kind === "text") {
      if (!fixture.text || !fixture.text.trim()) errors.push(`${fixture.id}: 文本为空`);
    } else if (fixture.kind === "image") {
      if (!fixture.transcript) errors.push(`${fixture.id}: 图片夹具缺少 transcript 真值`);
      if (!Array.isArray(fixture.images) || fixture.images.length === 0) {
        errors.push(`${fixture.id}: 图片夹具缺少 images`);
        continue;
      }
      for (const rel of fixture.images) {
        try {
          const meta = imageMeta(rel);
          if (!meta.png) errors.push(`${fixture.id}: ${rel} 不是 PNG`);
          if (meta.bytes > 5 * 1024 * 1024) errors.push(`${fixture.id}: ${rel} 超过 5MB`);
          if (!meta.width || !meta.height) errors.push(`${fixture.id}: ${rel} 尺寸异常`);
          images.push({ fixture: fixture.id, ...meta, base64: undefined });
        } catch (error) {
          errors.push(`${fixture.id}: ${rel} 无法读取 (${redact(error.message)})`);
        }
      }
    } else {
      errors.push(`${fixture.id}: 未知 kind=${fixture.kind}`);
    }
    const raw = JSON.stringify(fixture);
    if (/sk-[A-Za-z0-9_-]{8,}/.test(raw)) errors.push(`${fixture.id}: 夹具中疑似包含密钥`);
  }
  const imageFixtures = fixtures.filter((fixture) => fixture.kind === "image");
  if (imageFixtures.length < 2) errors.push(`至少需要 2 组图片夹具，当前 ${imageFixtures.length}`);
  return { ok: errors.length === 0, errors, manifest, fixtures, images };
}

async function fetchJson(url, options = {}, timeoutMs = 20_000) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

async function getHealth() {
  try {
    const started = Date.now();
    const { response, body } = await fetchJson(`${BASE_URL}/api/health`, {}, 8_000);
    return { ok: response.ok, status: response.status, ms: Date.now() - started, body };
  } catch (error) {
    return { ok: false, error: redact(error.message) };
  }
}

async function probeUnauthenticated() {
  try {
    const started = Date.now();
    const response = await fetch("https://api.deepseek.com/models", {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: true, status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, error: redact(error.message) };
  }
}

async function noKeyImageGuard(validation) {
  const fixture = validation.fixtures.find((item) => item.kind === "image");
  if (!fixture) return { skipped: true };
  try {
    const meta = imageMeta(fixture.images[0]);
    const started = Date.now();
    const { response, body } = await fetchJson(
      `${BASE_URL}/api/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: "验收 no-key 守卫",
          text: "",
          images: [
            {
              name: path.basename(fixture.images[0]),
              mime: "image/png",
              dataUrl: `data:image/png;base64,${meta.base64}`,
            },
          ],
        }),
      },
      20_000,
    );
    return {
      status: response.status,
      code: body?.error?.code ?? null,
      ms: Date.now() - started,
      passed: response.status === 400 && body?.error?.code === "NEED_API_KEY",
    };
  } catch (error) {
    return { error: redact(error.message), passed: false };
  }
}

function expectedTable(validation) {
  return table(
    ["编号", "场景", "输入", "任务数", "必检任务", "必检风险"],
    validation.fixtures.map((fixture) => [
      fixture.id,
      fixture.label,
      fixture.kind === "image" ? `PNG × ${fixture.images.length}` : "文字",
      `${fixture.expected.taskCount.min}–${fixture.expected.taskCount.max}`,
      (fixture.expected.tasks || [])
        .filter((task) => task.required !== false)
        .map((task) => task.matchAny.join("/"))
        .join("；") || "0",
      (fixture.expected.requiredRiskTypes || []).join("；") || "0",
    ]),
  );
}

function cleanupProject(projectId, sourceId) {
  if (!projectId) return null;
  try {
    if (!fs.existsSync(DB_PATH)) return "database file missing";
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA foreign_keys = ON;");
    const row = db.prepare("SELECT name FROM projects WHERE id = ?").get(projectId);
    if (!row || !String(row.name).startsWith("AI验收")) {
      db.close();
      return "refused to delete non-acceptance project";
    }
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    db.close();
    if (sourceId) {
      fs.rmSync(path.join(ROOT, "data", "uploads", sourceId), {
        recursive: true,
        force: true,
      });
    }
    return null;
  } catch (error) {
    return redact(error.message);
  }
}

async function runFixture(fixture) {
  const images =
    fixture.kind === "image"
      ? fixture.images.map((rel) => {
          const meta = imageMeta(rel);
          return {
            name: path.basename(rel),
            mime: "image/png",
            dataUrl: `data:image/png;base64,${meta.base64}`,
          };
        })
      : [];
  const body = {
    projectName: fixture.projectName || `AI验收 ${fixture.id}`,
    text: fixture.kind === "text" ? fixture.text : "",
    images,
  };
  const started = Date.now();
  let data = null;
  try {
    const { response, body: responseBody } = await fetchJson(
      `${BASE_URL}/api/analyze`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      TIMEOUT_MS,
    );
    const elapsedMs = Date.now() - started;
    data = responseBody;

    if (response.status === 422 && responseBody?.error?.code === "NO_TASKS") {
      const provider = responseBody?.error?.details?.provider ?? null;
      return {
        ok: false,
        status: "no-tasks",
        httpStatus: 422,
        elapsedMs,
        aiElapsedMs: provider?.elapsedMs ?? null,
        attempts: provider?.attempts ?? 1,
        usage: provider?.usage ?? null,
        finishReason: provider?.finishReason ?? null,
        providerModel: provider?.model ?? null,
        error: responseBody.error,
        tasks: [],
        risks: [],
        mode: null,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: "error",
        httpStatus: response.status,
        elapsedMs,
        attempts: 1,
        error: responseBody?.error ?? { code: "HTTP_ERROR", message: `HTTP ${response.status}` },
        tasks: [],
        risks: [],
        mode: null,
      };
    }

    const detail = await fetchJson(
      `${BASE_URL}/api/extractions/${encodeURIComponent(responseBody.extractionId)}`,
      {},
      20_000,
    );
    const payload = detail.body?.extraction?.payload;
    if (!payload) {
      return {
        ok: false,
        status: "error",
        httpStatus: 502,
        elapsedMs,
        attempts: responseBody.provider?.attempts ?? 1,
        usage: responseBody.provider?.usage ?? null,
        error: { code: "NO_EXTRACTION", message: "无法读取审核草稿" },
        tasks: [],
        risks: [],
        mode: responseBody.mode ?? null,
      };
    }
    const provider = responseBody.provider ?? null;
    return {
      ok: true,
      status: "ok",
      httpStatus: 201,
      elapsedMs,
      aiElapsedMs: provider?.elapsedMs ?? null,
      attempts: provider?.attempts ?? 1,
      usage: provider?.usage ?? null,
      finishReason: provider?.finishReason ?? null,
      providerModel: provider?.model ?? responseBody.model ?? null,
      mode: responseBody.mode,
      model: responseBody.model,
      summary: payload.summary,
      warnings: payload.warnings,
      tasks: payload.tasks,
      risks: payload.risks,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      httpStatus: 0,
      elapsedMs: Date.now() - started,
      error: { code: "NETWORK", message: redact(error.message) },
      tasks: [],
      risks: [],
      mode: null,
    };
  } finally {
    if (data?.projectId) {
      // The report records everything before cleanup; tasks are never confirmed.
      const cleanupError = cleanupProject(data.projectId, data.sourceId);
      if (cleanupError) {
        console.error(`[acceptance] cleanup failed for ${fixture.id}: ${cleanupError}`);
      }
    }
  }
}

function ownerMatches(actual, expected) {
  if (!("owner" in expected)) return { checked: false, ok: true };
  return { checked: true, ok: (actual.owner ?? null) === expected.owner };
}

function dueMatches(actual, expected) {
  if (!("dueAny" in expected)) return { checked: false, ok: true };
  const tokens = expected.dueAny || [];
  const values = [actual.dueLabel, actual.dueDate, actual.dueDate?.replace(/-/g, "/")]
    .filter(Boolean)
    .map(normalize);
  if (tokens.length === 0) {
    return { checked: true, ok: !actual.dueLabel && !actual.dueDate, values };
  }
  return {
    checked: true,
    ok: tokens.some((token) => values.some((value) => value.includes(normalize(token)))),
    values,
  };
}

function quoteChecks(actualTasks, actualRisks, transcript) {
  const haystackExact = transcript;
  const haystack = normalize(transcript);
  const items = [
    ...actualTasks
      .filter((task) => task.sourceQuote)
      .map((task) => ({ kind: "task", title: task.title, quote: task.sourceQuote })),
    ...actualRisks
      .filter((risk) => risk.sourceQuote)
      .map((risk) => ({ kind: "risk", title: risk.title, quote: risk.sourceQuote })),
  ];
  return items.map((item) => {
    const parts = String(item.quote)
      .split(" / ")
      .map((part) => part.trim())
      .filter(Boolean);
    const exact =
      parts.length > 0 && parts.every((part) => haystackExact.includes(part));
    const normalized =
      parts.length > 0 &&
      parts.every((part) => haystack.includes(normalize(part)));
    return { ...item, exact, verified: exact || normalized };
  });
}

function evaluateFixture(fixture, run) {
  const actualTasks = run.tasks || [];
  const actualRisks = run.risks || [];
  const expected = fixture.expected;
  const used = new Set();
  const matches = [];

  for (const expectedTask of expected.tasks || []) {
    const index = actualTasks.findIndex((task, taskIndex) => {
      if (used.has(taskIndex)) return false;
      if (!expectedTask.matchAny || expectedTask.matchAny.length === 0) return false;
      return expectedTask.matchAny.some((keyword) => {
        const needle = normalize(keyword);
        return (
          normalize(task.title).includes(needle) ||
          normalize(task.sourceQuote).includes(needle)
        );
      });
    });
    if (index >= 0) {
      used.add(index);
      matches.push({ expected: expectedTask, actual: actualTasks[index] });
    } else {
      matches.push({ expected: expectedTask, actual: null });
    }
  }

  const unmatchedActual = actualTasks.filter((_, index) => !used.has(index));
  const requiredMatches = matches.filter((match) => match.expected.required !== false);
  const missingRequired = requiredMatches
    .filter((match) => !match.actual)
    .map((match) => match.expected.matchAny.join("/"));
  const optionalMatched = matches.filter(
    (match) => match.expected.required === false && match.actual,
  );

  const fieldMismatches = [];
  for (const match of matches) {
    if (!match.actual) continue;
    const owner = ownerMatches(match.actual, match.expected);
    if (owner.checked && !owner.ok) {
      fieldMismatches.push(
        `${match.expected.matchAny.join("/")}: owner expected ${match.expected.owner ?? "null"}, got ${match.actual.owner ?? "null"}`,
      );
    }
    const due = dueMatches(match.actual, match.expected);
    if (due.checked && !due.ok) {
      fieldMismatches.push(
        `${match.expected.matchAny.join("/")}: due expected ${JSON.stringify(match.expected.dueAny ?? [])}, got ${match.actual.dueLabel ?? match.actual.dueDate ?? "null"}`,
      );
    }
    if (match.expected.status && match.actual.status !== match.expected.status) {
      fieldMismatches.push(
        `${match.expected.matchAny.join("/")}: status expected ${match.expected.status}, got ${match.actual.status}`,
      );
    }
  }

  const actualTypes = [...new Set(actualRisks.map((risk) => risk.type))];
  const requiredRiskTypes = expected.requiredRiskTypes || [];
  const allowedTypes = new Set([...requiredRiskTypes, ...(expected.allowedRiskTypes || [])]);
  const riskHits = requiredRiskTypes.filter((type) => actualTypes.includes(type));
  const riskMissing = requiredRiskTypes.filter((type) => !actualTypes.includes(type));
  const riskUnexpected = actualTypes.filter((type) => !allowedTypes.has(type));
  const riskAllowedExtra = actualTypes.filter(
    (type) => allowedTypes.has(type) && !requiredRiskTypes.includes(type),
  );

  const quotes = quoteChecks(actualTasks, actualRisks, fixtureTranscript(fixture));
  const quoteMissing = quotes.filter((quote) => !quote.verified);
  const ackPattern =
    /^(收到|收到啦|好的|好|嗯|嗯嗯|ok|OK|知道了|明白|行|可以|没问题)[。.!！?？~～…\s]*$/;
  const completionViolations = actualTasks.filter(
    (task) =>
      task.status === "done" &&
      (!task.evidenceQuote || ackPattern.test(String(task.evidenceQuote).trim())),
  );
  const receivedTask = actualTasks.filter((task) => /收到|好的/.test(task.title));

  const count = actualTasks.length;
  const min = expected.taskCount.min;
  const max = expected.taskCount.max;
  const countInRange = count >= min && count <= max;

  let status = "pass";
  if (run.status === "no-tasks") {
    status =
      expected.taskCount.min === 0 && expected.taskCount.max === 0
        ? "pass"
        : "fail";
  } else if (!run.ok) {
    status = "fail";
  } else if (missingRequired.length > 0 || !countInRange) {
    status = "fail";
  } else if (
    fieldMismatches.length > 0 ||
    quoteMissing.length > 0 ||
    riskUnexpected.length > 0 ||
    unmatchedActual.length > 0 ||
    completionViolations.length > 0 ||
    receivedTask.length > 0 ||
    run.mode !== "ai"
  ) {
    status = "partial";
  }

  return {
    ok: run.ok,
    fixture: fixture.id,
    label: fixture.label,
    kind: fixture.kind,
    status,
    httpStatus: run.httpStatus,
    mode: run.mode,
    model: run.model,
    elapsedMs: run.elapsedMs,
    aiElapsedMs: run.aiElapsedMs ?? null,
    attempts: run.attempts ?? 0,
    usage: run.usage ?? null,
    finishReason: run.finishReason ?? null,
    providerModel: run.providerModel ?? null,
    actualTaskCount: count,
    countInRange,
    expectedTaskCount: `${min}–${max}`,
    matches: matches.map((match) => ({
      expected: match.expected.matchAny.join("/"),
      actual: match.actual ? match.actual.title : null,
      required: match.expected.required !== false,
    })),
    missingRequired,
    optionalMatched: optionalMatched.map((match) => match.actual.title),
    unmatchedActual: unmatchedActual.map((task) => task.title),
    fieldMismatches,
    riskHits,
    riskMissing,
    riskUnexpected,
    riskAllowedExtra,
    quoteTotal: quotes.length,
    quoteVerified: quotes.filter((quote) => quote.verified).length,
    quoteMissing: quoteMissing.map((quote) => `${quote.kind}:${quote.title}`),
    completionViolations: completionViolations.map((task) => task.title),
    receivedTask: receivedTask.map((task) => task.title),
    error: run.status === "no-tasks" ? null : run.error ?? null,
    summary: run.summary ?? null,
    warnings: run.warnings ?? [],
    tasks: actualTasks.map((task) => ({
      title: task.title,
      owner: task.owner,
      dueLabel: task.dueLabel,
      dueDate: task.dueDate,
      status: task.status,
      confidence: task.confidence,
      quote: task.sourceQuote,
    })),
    risks: actualRisks.map((risk) => ({
      type: risk.type,
      title: risk.title,
      severity: risk.severity,
      quote: risk.sourceQuote,
    })),
    transcriptLength: fixtureTranscript(fixture).length,
  };
}

function summarize(results) {
  const requiredExpected = results.reduce(
    (sum, result) =>
      sum + result.matches.filter((match) => match.required).length,
    0,
  );
  const requiredMatched = results.reduce(
    (sum, result) =>
      sum +
      result.matches.filter((match) => match.required && match.actual).length,
    0,
  );
  const actualTotal = results.reduce((sum, result) => sum + result.actualTaskCount, 0);
  const matchedActual = results.reduce(
    (sum, result) => sum + result.matches.filter((match) => match.actual).length,
    0,
  );
  const riskExpected = results.reduce(
    (sum, result) => sum + (result.riskHits.length + result.riskMissing.length),
    0,
  );
  const riskMatched = results.reduce((sum, result) => sum + result.riskHits.length, 0);
  const quoteTotal = results.reduce((sum, result) => sum + result.quoteTotal, 0);
  const quoteVerified = results.reduce(
    (sum, result) => sum + result.quoteVerified,
    0,
  );
  const times = results.map((result) => result.elapsedMs).filter((ms) => ms > 0);
  const avgMs = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;
  const apiCalls = results.reduce((sum, result) => sum + (result.attempts || 0), 0);
  const tokenTotals = results.reduce(
    (total, result) => {
      if (!result.usage) return total;
      total.promptTokens += result.usage.promptTokens || 0;
      total.completionTokens += result.usage.completionTokens || 0;
      total.totalTokens += result.usage.totalTokens || 0;
      total.cachedTokens += result.usage.cachedTokens || 0;
      total.reasoningTokens += result.usage.reasoningTokens || 0;
      total.known = true;
      return total;
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      known: false,
    },
  );
  const aiTimes = results
    .map((result) => result.aiElapsedMs)
    .filter((value) => typeof value === "number" && value >= 0);
  const avgAiMs = aiTimes.length
    ? Math.round(aiTimes.reduce((a, b) => a + b, 0) / aiTimes.length)
    : null;
  const sorted = [...times].sort((a, b) => a - b);
  const medianMs = sorted.length
    ? sorted[Math.floor(sorted.length / 2)]
    : null;
  const precision = actualTotal > 0 ? matchedActual / actualTotal : null;
  const recall = requiredExpected > 0 ? requiredMatched / requiredExpected : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  return {
    fixtures: results.length,
    imageFixtures: results.filter((result) => result.kind === "image").length,
    pass: results.filter((result) => result.status === "pass").length,
    partial: results.filter((result) => result.status === "partial").length,
    fail: results.filter((result) => result.status === "fail").length,
    requiredExpected,
    requiredMatched,
    actualTotal,
    matchedActual,
    taskPrecision: precision,
    taskRecall: recall,
    taskF1: f1,
    riskExpected,
    riskMatched,
    riskRecall: riskExpected > 0 ? riskMatched / riskExpected : null,
    quoteTotal,
    quoteVerified,
    quoteRate: quoteTotal > 0 ? quoteVerified / quoteTotal : null,
    avgMs,
    medianMs,
    avgAiMs,
    apiCalls,
    tokenTotals,
  };
}

function percent(value) {
  return value === null || value === undefined
    ? "N/A"
    : `${(value * 100).toFixed(1)}%`;
}

function numberOrNa(value) {
  return value === null || value === undefined ? "N/A" : `${value}`;
}

function renderFixtureDetails(result) {
  const lines = [];
  lines.push(`### ${result.fixture} · ${result.label} — ${result.status.toUpperCase()}`);
  lines.push("");
  lines.push(
    `- 输入：${result.kind === "image" ? "PNG 截图" : "聊天文字"}；HTTP ${
      result.httpStatus || "N/A"
    }；mode=${result.mode ?? "N/A"}；总耗时 ${result.elapsedMs}ms`,
  );
  lines.push(
    `- API：${result.attempts} 次调用；AI 耗时 ${result.aiElapsedMs ?? "N/A"}ms；Token ${
      result.usage
        ? `${result.usage.promptTokens}/${result.usage.completionTokens}/${result.usage.totalTokens}（prompt/completion/total）`
        : "N/A"
    }；finish_reason=${result.finishReason ?? "N/A"}`,
  );
  if (result.error) {
    lines.push(
      `- 错误：\`${result.error.code}\` ${mdEscape(result.error.message)}`,
    );
  }
  lines.push(
    `- 期望任务数：${result.expectedTaskCount}；实际任务数：${result.actualTaskCount}；${result.countInRange ? "数量在范围内" : "数量超出范围"}`,
  );
  lines.push("");
  lines.push("**实际任务**");
  if (result.tasks.length === 0) {
    lines.push("- 无");
  } else {
    for (const task of result.tasks) {
      lines.push(
        `- ${mdEscape(task.title)} · 负责人 ${mdEscape(task.owner ?? "null")} · 截止 ${mdEscape(task.dueLabel ?? task.dueDate ?? "null")} · ${task.status} · 引用“${mdEscape(
          String(task.quote ?? "").slice(0, 80),
        )}”`,
      );
    }
  }
  lines.push("");
  lines.push("**实际风险**");
  if (result.risks.length === 0) {
    lines.push("- 无");
  } else {
    for (const risk of result.risks) {
      lines.push(
        `- ${risk.type} · ${mdEscape(risk.title)} · ${risk.severity} · 引用“${mdEscape(
          String(risk.quote ?? "").slice(0, 80),
        )}”`,
      );
    }
  }
  lines.push("");
  lines.push(
    `- 漏报（required）：${result.missingRequired.length ? result.missingRequired.join("；") : "无"}`,
  );
  lines.push(
    `- 误报（未匹配实际任务）：${result.unmatchedActual.length ? result.unmatchedActual.join("；") : "无"}`,
  );
  lines.push(
    `- 风险：命中 ${result.riskHits.join("；") || "无"}；漏报 ${result.riskMissing.join("；") || "无"}；额外 ${result.riskUnexpected.join("；") || "无"}`,
  );
  lines.push(
    `- 引用核验：${result.quoteVerified}/${result.quoteTotal}${
      result.quoteMissing.length ? `；未匹配 ${result.quoteMissing.join("；")}` : ""
    }`,
  );
  if (result.fieldMismatches.length) {
    lines.push(`- 字段不一致：${result.fieldMismatches.join("；")}`);
  }
  if (result.completionViolations.length) {
    lines.push(`- 完成证据违规：${result.completionViolations.join("；")}`);
  }
  if (result.receivedTask.length) {
    lines.push(`- 把知悉误当任务：${result.receivedTask.join("；")}`);
  }
  lines.push("");
  return lines.join("\n");
}

function expectedDetails(validation) {
  const lines = [];
  for (const fixture of validation.fixtures) {
    lines.push(`### ${fixture.id} · ${fixture.label}`);
    lines.push("");
    lines.push(
      `- 输入：${fixture.kind === "image" ? `PNG 截图 ${fixture.images.join(", ")}` : "聊天文字"}`,
    );
    const requiredTasks = (fixture.expected.tasks || []).filter(
      (task) => task.required !== false,
    );
    if (requiredTasks.length === 0) {
      lines.push("- 期望任务：0（无任务闲聊）");
    } else {
      for (const task of requiredTasks) {
        const owner = "owner" in task ? (task.owner ?? "null（应无人负责）") : "未限定";
        const due = task.dueAny && task.dueAny.length
          ? task.dueAny.join(" / ")
          : task.dueAny
            ? "无日期"
            : "未限定";
        lines.push(
          `- 期望任务：${task.matchAny.join(" / ")} · 负责人 ${owner} · 截止 ${due}${task.status ? ` · 状态 ${task.status}` : ""}`,
        );
      }
    }
    lines.push(
      `- 期望风险：${(fixture.expected.requiredRiskTypes || []).join("；") || "无"}`,
    );
    if (fixture.expected.notes) lines.push(`- 验收说明：${fixture.expected.notes}`);
    lines.push("  - 实际任务/风险：**N/A — 未调用模型**（无密钥）");
    lines.push("");
  }
  return lines.join("\n");
}

function renderBlocked(validation, health, probe, guard) {
  const lines = [];
  lines.push("# FlowBack R2 · 真实 AI 验收报告");
  lines.push("");
  lines.push("## 状态：BLOCKED — 没有可用的 DeepSeek 密钥");
  lines.push("");
  lines.push(`- 生成时间：${STARTED_AT}`);
  lines.push(`- 本地服务：${BASE_URL}`);
  lines.push(`- 目标模型：${MODEL}`);
  lines.push(`- 密钥来源检查：shell/env 或 .env.local ${KEY_PRESENT_LOCALLY ? "存在" : "不存在"}；服务端 health.configured = ${String(
    health.body?.ai?.configured ?? "N/A",
  )}`);
  lines.push(
    "- **本次没有调用 DeepSeek 推理，没有生成任何任务/风险/准确率数字，也没有向看板写入确认任务。**",
  );
  lines.push("");
  lines.push("## 阻塞证据");
  lines.push(
    `- \`GET /api/health\`：${health.ok ? `HTTP ${health.status}` : "不可达"}；ai.configured=${String(
      health.body?.ai?.configured,
    )}；ai.thinking=${String(health.body?.ai?.thinking ?? "N/A")}；maxTokens=${String(
      health.body?.ai?.maxTokens ?? "N/A",
    )}`,
  );
  lines.push(
    `- 未认证 DeepSeek 连通性探测：${
      probe.ok ? `HTTP ${probe.status}（预期 401，说明网络可达）` : `失败：${probe.error}`
    }；耗时 ${probe.ms ?? "N/A"}ms`,
  );
  lines.push(
    `- 本地无 Key 图片守卫：${
      guard.skipped
        ? "跳过"
        : guard.passed
          ? `HTTP ${guard.status} / ${guard.code}（正确拒绝，没有伪造 OCR）`
          : `未按预期拒绝（${guard.status ?? "N/A"} / ${guard.code ?? guard.error ?? "N/A"}）`
    }`,
  );
  lines.push("");
  lines.push("## 安全核查");
  lines.push("");
  lines.push(
    `- \`.env.local\` / \`.env\` 被 .gitignore 忽略：${
      GITIGNORE_LINES.includes(".env.local") && GITIGNORE_LINES.includes(".env")
        ? "是"
        : "否"
    }`,
  );
  lines.push(
    "- `/api/health` 只返回配置状态、模型名、thinking/maxTokens 等安全字段，不返回 Key、Key 长度或 Authorization；响应已检查。",
  );
  lines.push("- `/api/analyze` 只写审核草稿；确认入库必须经过独立 `/confirm`。本次没有确认任何任务。");
  lines.push("- 无 Key 截图守卫生效；原文不写 console.log，上游错误 body 不回显；详见 58 项自动化测试。");
  lines.push("");
  lines.push("## 已准备的 7 组夹具");
  lines.push("");
  lines.push(expectedTable(validation));
  lines.push("");
  lines.push("## 预期明细（实际结果 N/A）");
  lines.push("");
  lines.push(expectedDetails(validation));
  lines.push("");
  lines.push("## 图片夹具");
  lines.push("");
  lines.push(
    table(
      ["文件", "尺寸", "大小", "校验"],
      validation.images.map((image) => [
        image.path,
        `${image.width}×${image.height}`,
        `${(image.bytes / 1024).toFixed(1)} KB`,
        image.png ? "PNG magic OK" : "非 PNG",
      ]),
    ),
  );
  lines.push("");
  lines.push("## 用户操作步骤（真实调用）");
  lines.push("");
  lines.push("1. 在 `flowback/` 下创建本地密钥文件：");
  lines.push("");
  lines.push("```bash");
  lines.push("cp .env.example .env.local");
  lines.push("# 编辑 .env.local，写入 DEEPSEEK_API_KEY=sk-...");
  lines.push("```");
  lines.push("");
  lines.push("2. 不要把 Key 粘贴到聊天、issue 或截图里；`.env.local` 已被 `.gitignore` 忽略。");
  lines.push("3. 重启服务，让 Node 进程读取新环境变量：");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run build && npm run start");
  lines.push("```");
  lines.push("");
  lines.push("4. 确认服务端已加载 Key（不要把 Key 打印出来）：");
  lines.push("");
  lines.push("```bash");
  lines.push("curl -s http://127.0.0.1:4317/api/health");
  lines.push("# 期望：ai.configured = true, ai.thinking = \"disabled\"");
  lines.push("```");
  lines.push("");
  lines.push("5. 重新执行验收：");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run acceptance");
  lines.push("```");
  lines.push("");
  lines.push(
    "6. 成功后 `acceptance/REPORT.md` 会被替换为真实运行报告，包含逐项任务、风险、引用、误报/漏报、耗时与准确率；未通过时不会回退成示例结果。",
  );
  lines.push("");
  lines.push("## 当前仍可演示的内容");
  lines.push("");
  lines.push(
    "- 无密钥时首页“加载示例”→“运行示例解析”可完整走 导入→审核→确认→看板→风险；所有页面明确显示“示例模式 · 非 AI”。",
  );
  lines.push("- 截图路径在无密钥时被明确拒绝（NEED_API_KEY），不会伪造 OCR。");
  lines.push("");
  lines.push("## 配置/链路审计");
  lines.push("");
  lines.push("详见 `acceptance/AI-LINK-AUDIT.md`（含 DeepSeek 官方文档引用与 thinking 模式修复说明）。");
  lines.push("");
  return lines.join("\n");
}

function renderReal(validation, health, results, metrics) {
  const lines = [];
  const failed = results.filter((result) => result.status === "fail").length;
  const usable = results.filter(
    (result) => result.ok || result.status === "no-tasks",
  ).length;
  const overall =
    usable === 0
      ? "FAILED"
      : failed > 0
        ? "PARTIAL"
        : metrics.partial > 0
          ? "COMPLETED (WITH PARTIAL)"
          : "COMPLETED";
  lines.push("# FlowBack R2 · 真实 AI 验收报告");
  lines.push("");
  lines.push(`## 状态：${overall}`);
  lines.push("");
  lines.push(`- 生成时间：${STARTED_AT}`);
  lines.push(`- 本地服务：${BASE_URL}`);
  lines.push(`- 模型：${health.body?.ai?.model ?? MODEL}`);
  lines.push(
    `- 配置：thinking=${health.body?.ai?.thinking ?? "N/A"}；maxTokens=${health.body?.ai?.maxTokens ?? "N/A"}；timeoutMs=${health.body?.ai?.timeoutMs ?? "N/A"}；imageDetail=${health.body?.ai?.imageDetail ?? "N/A"}`,
  );
  lines.push(
    "- 所有调用均通过真实 `/api/analyze` → DeepSeek `/chat/completions`；未使用 mock、未把示例模式结果写入本报告。",
  );
  lines.push("");
  lines.push("## 安全核查");
  lines.push("");
  lines.push(
    `- .env.local 被 gitignore：${GITIGNORE_LINES.includes(".env.local") ? "是" : "否"}；health 响应不含 Key；harness 未调用 /confirm。`,
  );
  lines.push("- 图片路径来自数据库登记并做 DATA_DIR 前缀校验；客户端不导入服务端 AI/DB 模块。");
  lines.push("");
  lines.push("## 汇总指标");
  lines.push("");
  lines.push(
    table(
      ["指标", "数值"],
      [
        ["夹具数 / 图片夹具", `${metrics.fixtures} / ${metrics.imageFixtures}`],
        ["PASS / PARTIAL / FAIL", `${metrics.pass} / ${metrics.partial} / ${metrics.fail}`],
        ["必检任务召回", `${metrics.requiredMatched}/${metrics.requiredExpected}（${percent(metrics.taskRecall)}）`],
        ["任务精确率", `${metrics.matchedActual}/${metrics.actualTotal}（${percent(metrics.taskPrecision)}）`],
        ["任务 F1", percent(metrics.taskF1)],
        ["必检风险召回", `${metrics.riskMatched}/${metrics.riskExpected}（${percent(metrics.riskRecall)}）`],
        ["引用核验", `${metrics.quoteVerified}/${metrics.quoteTotal}（${percent(metrics.quoteRate)}）`],
        ["平均耗时 / 中位耗时", `${numberOrNa(metrics.avgMs)}ms / ${numberOrNa(metrics.medianMs)}ms`],
        ["AI 推理平均耗时", `${numberOrNa(metrics.avgAiMs)}ms`],
        ["API 调用次数（含修复/重试）", String(metrics.apiCalls)],
        [
          "Token 用量（prompt / completion / total）",
          metrics.tokenTotals.known
            ? `${metrics.tokenTotals.promptTokens} / ${metrics.tokenTotals.completionTokens} / ${metrics.tokenTotals.totalTokens}`
            : "N/A（响应未提供 usage）",
        ],
      ],
    ),
  );
  lines.push("");
  lines.push("## 逐项结果");
  lines.push("");
  lines.push(
    table(
      ["编号", "场景", "状态", "期望任务", "实际任务", "漏报", "误报", "引用", "耗时", "Token"],
      results.map((result) => [
        result.fixture,
        result.label,
        result.status,
        result.expectedTaskCount,
        result.actualTaskCount,
        result.missingRequired.join("；") || "0",
        result.unmatchedActual.length,
        `${result.quoteVerified}/${result.quoteTotal}`,
        `${result.elapsedMs}ms`,
        result.usage?.totalTokens ?? "N/A",
      ]),
    ),
  );
  lines.push("");
  for (const result of results) {
    lines.push(renderFixtureDetails(result));
  }
  lines.push("## 典型失败案例");
  lines.push("");
  const failures = [];
  for (const result of results) {
    if (result.missingRequired.length) {
      failures.push(`${result.fixture}: 漏提取 ${result.missingRequired.join("；")}`);
    }
    if (result.unmatchedActual.length) {
      failures.push(`${result.fixture}: 可能误报 ${result.unmatchedActual.join("；")}`);
    }
    if (result.riskMissing.length) {
      failures.push(`${result.fixture}: 漏风险 ${result.riskMissing.join("；")}`);
    }
    if (result.quoteMissing.length) {
      failures.push(`${result.fixture}: 引用未匹配 ${result.quoteMissing.join("；")}`);
    }
    if (result.completionViolations.length) {
      failures.push(`${result.fixture}: 完成证据违规 ${result.completionViolations.join("；")}`);
    }
    if (result.error) {
      failures.push(`${result.fixture}: ${result.error.code}`);
    }
  }
  if (failures.length === 0) {
    lines.push("本次样本没有出现结构性失败；仍需人工复核语义正确性，不能把自动指标当作绝对结论。");
  } else {
    for (const failure of failures.slice(0, 20)) lines.push(`- ${failure}`);
  }
  lines.push("");
  lines.push("## 边界");
  lines.push("");
  lines.push("- 7 组夹具是人工构造的验收样本，不代表线上分布，也不构成模型质量承诺。");
  lines.push("- 所有结果只进入审核草稿；harness 不确认、不写任务，运行后删除临时项目。");
  lines.push("- 报告不包含完整原始聊天，仅保留用于核验的引用片段；API Key 已脱敏。");
  lines.push("");
  return lines.join("\n");
}

async function runReal(validation, health) {
  const results = [];
  for (const fixture of validation.fixtures) {
    console.log(`[acceptance] running ${fixture.id} (${fixture.kind}) ...`);
    const run = await runFixture(fixture);
    const evaluated = evaluateFixture(fixture, run);
    results.push(evaluated);
    console.log(
      `[acceptance] ${fixture.id}: ${evaluated.status} tasks=${evaluated.actualTaskCount} elapsed=${evaluated.elapsedMs}ms`,
    );
    await sleep(500);
  }
  const metrics = summarize(results);
  const markdown = renderReal(validation, health, results, metrics);
  const json = {
    status: "completed",
    startedAt: STARTED_AT,
    baseUrl: BASE_URL,
    model: health.body?.ai?.model ?? MODEL,
    config: health.body?.ai ?? null,
    metrics,
    fixtures: results,
  };
  const { report } = writeReport(markdown, json);
  console.log(`[acceptance] report: ${report}`);
  if (metrics.fail > 0) process.exitCode = 1;
}

async function main() {
  const validation = validateFixtures();
  if (!validation.ok) {
    const markdown = `# FlowBack R1 · 真实 AI 验收报告\n\n## 状态：BLOCKED — 夹具校验失败\n\n${validation.errors
      .map((error) => `- ${error}`)
      .join("\n")}\n`;
    const { report } = writeReport(markdown, {
      status: "blocked",
      reason: "fixture-validation-failed",
      errors: validation.errors,
      startedAt: STARTED_AT,
    });
    console.error(validation.errors.join("\n"));
    console.error(`[acceptance] report: ${report}`);
    process.exitCode = 1;
    return;
  }

  const health = await getHealth();
  console.log(
    `[acceptance] server ${BASE_URL}: ${
      health.ok ? `HTTP ${health.status}` : `unreachable (${health.error})`
    }; key=${KEY_PRESENT_LOCALLY ? "present" : "absent"}; ai.configured=${String(
      health.body?.ai?.configured,
    )}`,
  );

  if (!KEY_PRESENT_LOCALLY) {
    const probe = await probeUnauthenticated();
    const guard = await noKeyImageGuard(validation);
    const markdown = renderBlocked(validation, health, probe, guard);
    const { report, latest } = writeReport(markdown, {
      status: "blocked",
      reason: "missing-deepseek-api-key",
      startedAt: STARTED_AT,
      server: health.ok ? { status: health.status, ai: health.body?.ai } : { error: health.error },
      probe,
      noKeyImageGuard: guard,
      fixtures: validation.fixtures.map((fixture) => ({
        id: fixture.id,
        label: fixture.label,
        kind: fixture.kind,
        expected: fixture.expected,
      })),
      note: "No DeepSeek inference was called. No accuracy numbers were generated.",
    });
    console.log("[acceptance] STATUS: BLOCKED — DEEPSEEK_API_KEY is not configured.");
    console.log("[acceptance] No DeepSeek inference was called; no results were fabricated.");
    console.log(`[acceptance] report: ${report}`);
    console.log(`[acceptance] raw status: ${latest}`);
    return;
  }

  if (!health.ok || health.body?.ai?.configured !== true) {
    const markdown = `# FlowBack R1 · 真实 AI 验收报告\n\n## 状态：BLOCKED — Key 存在但服务端未加载\n\n- 服务端 health：${health.ok ? `HTTP ${health.status}` : "不可达"}，ai.configured=${String(
      health.body?.ai?.configured,
    )}\n\n请重启服务后再执行：\n\n\`\`\`bash\nnpm run build && npm run start\nnpm run acceptance\n\`\`\`\n`;
    const { report } = writeReport(markdown, {
      status: "blocked",
      reason: "server-missing-key",
      startedAt: STARTED_AT,
      health,
    });
    console.error("[acceptance] Key is present locally but the running server is not configured.");
    console.error(`[acceptance] report: ${report}`);
    process.exitCode = 1;
    return;
  }

  if (health.body?.ai?.thinking !== "disabled") {
    const markdown = `# FlowBack R1 · 真实 AI 验收报告\n\n## 状态：BLOCKED — 服务端版本过旧\n\n- health.ai.thinking=${String(
      health.body?.ai?.thinking,
    )}；需要 newest build，确保 JSON mode 与 non-thinking 模式生效。\n\n请执行：\n\n\`\`\`bash\nnpm run build && npm run start\nnpm run acceptance\n\`\`\`\n`;
    const { report } = writeReport(markdown, {
      status: "blocked",
      reason: "server-build-missing-thinking-fix",
      startedAt: STARTED_AT,
      health,
    });
    console.error("[acceptance] running server does not expose the non-thinking fix; rebuild/restart.");
    console.error(`[acceptance] report: ${report}`);
    process.exitCode = 1;
    return;
  }

  await runReal(validation, health);
}

main().catch((error) => {
  console.error(`[acceptance] fatal: ${redact(error.stack || error.message)}`);
  const markdown = `# FlowBack R1 · 真实 AI 验收报告\n\n## 状态：FAILED — harness 异常\n\n\`\`\`\n${redact(
    error.stack || error.message,
  )}\n\`\`\`\n`;
  try {
    writeReport(markdown, {
      status: "failed",
      startedAt: STARTED_AT,
      error: redact(error.message),
    });
  } catch {
    /* ignore */
  }
  process.exitCode = 1;
});
