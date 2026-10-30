import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details: details ?? null } },
    { status },
  );
}

export function validationError(error: ZodError): NextResponse {
  return jsonError(422, "VALIDATION", "提交内容未通过校验，请检查后重试。", {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: jsonError(400, "INVALID_JSON", "请求体不是合法的 JSON。"),
    };
  }
}

export function clampError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "未知错误";
}
