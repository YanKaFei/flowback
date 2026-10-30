import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateRisk } from "@/lib/repo";
import { updateRiskSchema } from "@/lib/schemas";
import { jsonError, readJsonBody, validationError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = updateRiskSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const risk = updateRisk(id, parsed.data, auth.user.id);
    if (!risk) {
      return jsonError(404, "RISK_NOT_FOUND", "风险记录不存在或已被删除。");
    }
    return NextResponse.json({ risk });
  } catch {
    return jsonError(500, "RISK_UPDATE_FAILED", "风险更新失败，请稍后重试。");
  }
}
