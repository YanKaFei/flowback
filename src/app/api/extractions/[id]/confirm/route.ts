import { NextResponse } from "next/server";
import { safeError } from "@/lib/log";
import { requireUser } from "@/lib/auth";
import { confirmExtraction, getExtractionDetail } from "@/lib/repo";
import { confirmExtractionSchema } from "@/lib/schemas";
import {
  finalizeRisks,
  hasCompletionEvidence,
  reconcileTasks,
} from "@/lib/analysis";
import {
  clampError,
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const owned = getExtractionDetail(id, auth.user.id);
  const extraction = owned?.extraction;
  if (!extraction) {
    return jsonError(404, "EXTRACTION_NOT_FOUND", "审核记录不存在。");
  }
  if (extraction.status === "confirmed") {
    return jsonError(
      409,
      "ALREADY_CONFIRMED",
      "该来源已经确认过，请直接查看任务看板。",
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = confirmExtractionSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const invalidDone = parsed.data.tasks.filter(
    (task) => task.status === "done" && !hasCompletionEvidence(task.evidenceQuote),
  );
  if (invalidDone.length > 0) {
    return jsonError(
      422,
      "DONE_NEEDS_EVIDENCE",
      `以下任务被标记为完成，但完成证据缺失或只是“收到/好的”之类的知悉回复：${invalidDone
        .map((task) => `「${task.title}」`)
        .join("、")}。请补充明确的完成原文，或改回待处理。`,
    );
  }

  const tasks = reconcileTasks(parsed.data.tasks);
  if (tasks.length === 0) {
    return jsonError(422, "NO_TASKS", "至少需要保留一个任务才能确认。");
  }

  const risks = finalizeRisks(tasks, parsed.data.risks);

  try {
    const result = confirmExtraction({
      extraction,
      tasks,
      risks,
      summary: extraction.payload.summary,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[flowback] confirm failed", safeError(error));
    return jsonError(
      500,
      "CONFIRM_FAILED",
      `写入任务失败：${clampError(error)}`,
    );
  }
}
