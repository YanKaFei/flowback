import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  analyzeRequestSchema,
  MAX_IMAGES,
} from "@/lib/schemas";
import { buildLocalExtraction } from "@/lib/demo";
import type { StoredImage } from "@/lib/repo";
import { buildPayload, markUnverifiedImageQuotes } from "@/lib/analysis";
import {
  analyzeWithDeepSeekWithMeta,
  AiError,
  getAiConfig,
  isAiConfigured,
  type AiCallMeta,
} from "@/lib/deepseek";
import {
  createExtraction,
  createProject,
  createSource,
  getProject,
} from "@/lib/repo";
import { decodeImageDataUrl, saveSourceImages } from "@/lib/uploads";
import { newId } from "@/lib/utils";
import {
  clampError,
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function defaultProjectName(): string {
  const now = new Date();
  return `对话整理 ${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
}

export async function POST(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = analyzeRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;
  const text = input.text.trim();
  const images = input.images;
  const hasImages = images.length > 0;

  if (input.projectId) {
    const project = getProject(input.projectId, user.id);
    if (!project) {
      return jsonError(404, "PROJECT_NOT_FOUND", "项目不存在或已被删除。");
    }
  }

  if (hasImages && !isAiConfigured()) {
    return jsonError(
      400,
      "NEED_API_KEY",
      "截图理解必须调用 DeepSeek 图片理解，但服务端未配置 DEEPSEEK_API_KEY。请配置密钥后重启服务，或改为粘贴聊天文字使用示例解析。",
    );
  }

  if (images.length > MAX_IMAGES) {
    return jsonError(400, "IMAGE_LIMIT", `最多上传 ${MAX_IMAGES} 张截图。`);
  }

  // Validate bytes before spending an API call.
  try {
    for (const image of images) {
      decodeImageDataUrl(image);
    }
  } catch (error) {
    return jsonError(
      422,
      "IMAGE_INVALID",
      error instanceof Error ? error.message : "图片格式不受支持。",
    );
  }

  let ai;
  let mode: "ai" | "demo";
  let model: string | null;
  let provider: AiCallMeta | null = null;
  const config = getAiConfig();

  if (isAiConfigured()) {
    try {
      const result = await analyzeWithDeepSeekWithMeta({ text, images });
      ai = result.extraction;
      provider = result.meta;
      mode = "ai";
      model = result.meta.model || config.model;
    } catch (error) {
      if (error instanceof AiError) {
        const status =
          error.code === "AI_TIMEOUT" || error.code === "AI_ABORTED"
            ? 504
            : error.code === "NO_KEY"
              ? 400
              : error.code === "AI_CONTENT_FILTER"
                ? 422
                : error.code === "AI_UPSTREAM" ||
                    error.code === "AI_NETWORK" ||
                    error.code === "AI_TRUNCATED" ||
                    error.code.startsWith("AI_INVALID")
                  ? 502
                  : 500;
        return jsonError(status, error.code, error.message);
      }
      return jsonError(
        500,
        "AI_UNKNOWN",
        `调用 DeepSeek 失败：${clampError(error)}`,
      );
    }
  } else {
    if (hasImages) {
      return jsonError(
        400,
        "NEED_API_KEY",
        "示例模式无法读取截图内容，请粘贴文字或配置 DEEPSEEK_API_KEY。",
      );
    }
    ai = buildLocalExtraction(text);
    mode = "demo";
    model = null;
  }

  let payload = buildPayload(ai, hasImages ? "" : text);
  if (mode === "demo") {
    payload = {
      ...payload,
      warnings: [
        "当前为内置示例解析（规则引擎），不是 DeepSeek 输出。",
        ...payload.warnings.filter((w) => !w.includes("示例解析")),
      ],
    };
  }
  if (hasImages) {
    if (!ai.transcript?.trim()) {
      payload = markUnverifiedImageQuotes(payload);
    }
    payload = {
      ...payload,
      tasks: payload.tasks.map((task) => ({
        ...task,
        needsConfirmation: true,
      })),
      warnings: [
        ...payload.warnings,
        "截图解析基于图片理解，引用文字请对照原图人工核对。",
      ],
    };
  }

  if (payload.tasks.length === 0) {
    return jsonError(
      422,
      "NO_TASKS",
      "没有从输入中识别到可执行任务。请补充更明确的行动或交付内容后重试。",
      provider ? { provider } : undefined,
    );
  }

  let projectId = input.projectId ?? null;
  if (!projectId) {
    const name =
      input.projectName?.trim() ||
      ai.project_name?.trim() ||
      defaultProjectName();
    projectId = createProject(name, user.id).id;
  }

  const sourceId = newId("src");
  let stored: StoredImage[] = [];
  if (hasImages) {
    try {
      stored = await saveSourceImages(sourceId, images);
    } catch (error) {
      return jsonError(
        500,
        "IMAGE_STORE_FAILED",
        `截图保存失败：${clampError(error)}`,
      );
    }
  }

  const kind = hasImages ? (text ? "mixed" : "image") : "text";
  const source = createSource({
    id: sourceId,
    projectId,
    kind,
    rawText: text,
    images: stored,
    fileNames: images.map((image) => image.name),
    mode,
    model,
  });

  const extraction = createExtraction({
    sourceId: source.id,
    projectId,
    payload,
    mode,
    model,
    warnings: payload.warnings,
  });

  // Demo mode always analyses the built-in transcript; make that explicit to
  // callers so the UI can label it instead of passing it off as real AI.
  return NextResponse.json(
    {
      projectId,
      sourceId: source.id,
      extractionId: extraction.id,
      mode,
      model,
      summary: payload.summary,
      taskCount: payload.tasks.length,
      riskCount: payload.risks.length,
      provider,
    },
    { status: 201 },
  );
}
