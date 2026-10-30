import { NextResponse } from "next/server";
import { deleteProject, getProjectBundle } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const bundle = getProjectBundle(id, auth.user.id);
  if (!bundle) {
    return jsonError(404, "PROJECT_NOT_FOUND", "项目不存在或已被删除。");
  }
  return NextResponse.json(bundle);
}


export async function DELETE(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const deleted = deleteProject(id, auth.user.id);
  if (!deleted) {
    return jsonError(404, "PROJECT_NOT_FOUND", "项目不存在或已被删除。");
  }
  return NextResponse.json({ ok: true });
}
