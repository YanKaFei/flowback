import { NextResponse } from "next/server";
import {
  createDevUser,
  createSession,
  isDevAuthEnabled,
  isLocalHostRequest,
} from "@/lib/auth";
import { jsonError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDevAuthEnabled()) {
    return jsonError(403, "DEV_AUTH_DISABLED", "开发身份入口未开启。");
  }
  if (!isLocalHostRequest(request)) {
    return jsonError(403, "DEV_AUTH_LOCAL_ONLY", "开发身份入口仅限本机调试。");
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const deviceId =
    body.data && typeof body.data === "object"
      ? String((body.data as { deviceId?: unknown }).deviceId || "").trim()
      : "";
  if (deviceId.length < 8 || deviceId.length > 160) {
    return jsonError(422, "DEVICE_ID_INVALID", "设备标识长度需为 8–160 个字符。");
  }

  const user = createDevUser(deviceId);
  const session = createSession(user.id);
  return NextResponse.json(
    {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: user.id, displayName: user.displayName },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
