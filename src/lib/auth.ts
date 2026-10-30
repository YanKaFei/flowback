import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { AUTH_LOCAL_USER_ID, getDb } from "./db";
import { jsonError } from "./api";
import { newId, nowIso } from "./utils";

export type UserKind = "local" | "wechat" | "dev";

export interface AuthUser {
  id: string;
  kind: UserKind;
  displayName: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_COOKIE = "fb_local";

type UserRow = {
  id: string;
  kind: UserKind;
  display_name: string | null;
};

function mapUser(row: UserRow): AuthUser {
  return {
    id: String(row.id),
    kind: row.kind,
    displayName: row.display_name || "FlowBack 用户",
  };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cookieValue(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return "";
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
}

export function getLocalUser(): AuthUser | null {
  const row = getDb()
    .prepare("SELECT id, kind, display_name FROM users WHERE id = ?")
    .get(AUTH_LOCAL_USER_ID) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createWechatUser(openid: string): AuthUser {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, kind, display_name FROM users WHERE openid = ?")
    .get(openid) as UserRow | undefined;
  if (existing) return mapUser(existing);

  const id = newId("usr");
  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, kind, openid, display_name, created_at)
     VALUES (?, 'wechat', ?, '微信用户', ?)`,
  ).run(id, openid, now);
  return { id, kind: "wechat", displayName: "微信用户" };
}

export function createDevUser(deviceId: string): AuthUser {
  const db = getDb();
  const normalized = deviceId.trim().slice(0, 160);
  const openid = `dev:${hashToken(normalized).slice(0, 40)}`;
  const existing = db
    .prepare("SELECT id, kind, display_name FROM users WHERE openid = ?")
    .get(openid) as UserRow | undefined;
  if (existing) return mapUser(existing);

  const id = newId("usr");
  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, kind, openid, display_name, created_at)
     VALUES (?, 'dev', ?, '开发设备', ?)`,
  ).run(id, openid, now);
  return { id, kind: "dev", displayName: "开发设备" };
}

export function createSession(userId: string): {
  token: string;
  expiresAt: string;
} {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  getDb()
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(hashToken(token), userId, new Date(now).toISOString(), expiresAt);
  return { token, expiresAt };
}

export function resolveSession(token: string): AuthUser | null {
  if (!token || token.length > 256) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.kind, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), nowIso()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getAuthUser(request: Request): AuthUser | null {
  const authorization = request.headers.get("authorization") || "";
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim();
  if (bearer) return resolveSession(bearer);

  const localToken = process.env.FLOWBACK_LOCAL_TOKEN?.trim();
  const cookie = cookieValue(request.headers.get("cookie"), LOCAL_COOKIE);
  if (localToken && cookie && safeEqual(cookie, localToken)) {
    return getLocalUser();
  }
  return null;
}

export function requireUser(request: Request): AuthResult {
  const user = getAuthUser(request);
  if (!user) {
    return {
      ok: false,
      response: jsonError(401, "AUTH_REQUIRED", "请先建立安全会话后再使用 FlowBack。"),
    };
  }
  return { ok: true, user };
}

export function isLocalHostRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-host");
  const hostHeader = (forwarded || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
  if (!host) return true;
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function isWechatAuthConfigured(): boolean {
  return Boolean(
    process.env.WECHAT_APP_ID?.trim() && process.env.WECHAT_APP_SECRET?.trim(),
  );
}

export function isDevAuthEnabled(): boolean {
  return process.env.FLOWBACK_DEV_AUTH === "1";
}

export function publicAuthConfig(): {
  wechatLogin: boolean;
  devAuth: boolean;
  appIdConfigured: boolean;
} {
  return {
    wechatLogin: isWechatAuthConfigured(),
    devAuth: isDevAuthEnabled(),
    appIdConfigured: Boolean(process.env.WECHAT_APP_ID?.trim()),
  };
}
