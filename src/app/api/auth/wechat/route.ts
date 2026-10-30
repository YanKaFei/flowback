import { NextResponse } from "next/server";
import {
  createSession,
  createWechatUser,
  isWechatAuthConfigured,
} from "@/lib/auth";
import { jsonError, readJsonBody } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WechatSessionResponse = {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

export async function POST(request: Request) {
  if (!isWechatAuthConfigured()) {
    return jsonError(
      503,
      "WECHAT_AUTH_NOT_CONFIGURED",
      "服务端尚未配置 WECHAT_APP_ID / WECHAT_APP_SECRET，无法进行微信登录。",
    );
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const code =
    body.data && typeof body.data === "object"
      ? String((body.data as { code?: unknown }).code || "").trim()
      : "";
  if (!code || code.length > 256) {
    return jsonError(422, "WECHAT_CODE_INVALID", "微信登录 code 无效。");
  }

  const appId = process.env.WECHAT_APP_ID!.trim();
  const secret = process.env.WECHAT_APP_SECRET!.trim();
  const endpoint = new URL("https://api.weixin.qq.com/sns/jscode2session");
  endpoint.searchParams.set("appid", appId);
  endpoint.searchParams.set("secret", secret);
  endpoint.searchParams.set("js_code", code);
  endpoint.searchParams.set("grant_type", "authorization_code");

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return jsonError(502, "WECHAT_UPSTREAM", "微信登录服务暂时不可用，请稍后重试。");
  }

  if (!upstream.ok) {
    return jsonError(502, "WECHAT_UPSTREAM", "微信登录服务返回异常，请稍后重试。");
  }

  let data: WechatSessionResponse;
  try {
    data = (await upstream.json()) as WechatSessionResponse;
  } catch {
    return jsonError(502, "WECHAT_UPSTREAM", "微信登录服务返回了无法解析的结果。");
  }

  if (data.errcode || !data.openid) {
    return jsonError(
      401,
      "WECHAT_LOGIN_FAILED",
      "微信登录失败，请重新打开小程序后再试。",
    );
  }

  const user = createWechatUser(data.openid);
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
