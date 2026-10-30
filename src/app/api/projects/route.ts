import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/repo";
import { jsonError, readJsonBody, validationError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "项目名不能为空").max(60),
});

export async function GET(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ projects: listProjects(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = createProjectSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const project = createProject(parsed.data.name, auth.user.id);
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return jsonError(500, "PROJECT_CREATE_FAILED", "创建项目失败，请稍后重试。");
  }
}
