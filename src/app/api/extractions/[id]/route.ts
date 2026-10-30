import { NextResponse } from "next/server";
import { safeError } from "@/lib/log";
import { requireUser } from "@/lib/auth";
import { getExtractionDetail, saveExtractionDraft } from "@/lib/repo";
import { saveDraftSchema } from "@/lib/schemas";
import {
  clampError,
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const detail = getExtractionDetail(id, auth.user.id);
  if (!detail) {
    return jsonError(404, "EXTRACTION_NOT_FOUND", "审核记录不存在。");
  }
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const detail = getExtractionDetail(id, auth.user.id);
  if (!detail) {
    return jsonError(404, "EXTRACTION_NOT_FOUND", "审核记录不存在。");
  }
  if (detail.extraction.status === "confirmed") {
    return jsonError(409, "ALREADY_CONFIRMED", "该来源已确认，不能修改草稿。");
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = saveDraftSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const nextPayload = {
      summary: parsed.data.summary ?? detail.extraction.payload.summary,
      tasks: parsed.data.tasks,
      risks: parsed.data.risks,
      warnings: detail.extraction.warnings,
    };
    const updated = saveExtractionDraft(id, nextPayload);
    return NextResponse.json({ savedAt: updated?.updatedAt ?? new Date().toISOString() });
  } catch (error) {
    console.error("[flowback] save draft failed", safeError(error));
    return jsonError(
      500,
      "DRAFT_SAVE_FAILED",
      `草稿保存失败：${clampError(error)}`,
    );
  }
}
