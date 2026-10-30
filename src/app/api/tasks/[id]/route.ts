import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTaskEvents, updateTask } from "@/lib/repo";
import { updateTaskSchema } from "@/lib/schemas";
import {
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = updateTaskSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const task = updateTask(id, parsed.data, undefined, auth.user.id);
    if (!task) {
      return jsonError(404, "TASK_NOT_FOUND", "任务不存在或已被删除。");
    }
    return NextResponse.json({ task, events: getTaskEvents(task.id) });
  } catch {
    return jsonError(500, "TASK_UPDATE_FAILED", "任务更新失败，请稍后重试。");
  }
}
