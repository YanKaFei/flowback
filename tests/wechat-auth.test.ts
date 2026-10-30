import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setDatabaseForTests } from "@/lib/db";
import { POST as wechatLogin } from "@/app/api/auth/wechat/route";

describe("server-side WeChat login exchange", () => {
  beforeEach(() => {
    setDatabaseForTests(":memory:");
    vi.stubEnv("WECHAT_APP_ID", "wx-test-app-id");
    vi.stubEnv("WECHAT_APP_SECRET", "server-only-test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exchanges the code and never returns openid or session_key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        openid: "o-test-openid",
        session_key: "server-session-key",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await wechatLogin(
      new Request("http://127.0.0.1:4317/api/auth/wechat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "wx-login-code" }),
      }),
    );
    const body = (await response.json()) as {
      token?: string;
      user?: { id?: string; displayName?: string };
    };

    expect(response.status).toBe(201);
    expect(body.token?.length).toBeGreaterThan(30);
    expect(body.user?.id).toMatch(/^usr_/);
    expect(JSON.stringify(body)).not.toContain("o-test-openid");
    expect(JSON.stringify(body)).not.toContain("server-session-key");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("jscode2session");
    expect(calledUrl).toContain("appid=wx-test-app-id");
    expect(calledUrl).not.toContain("server-session-key");
  });

  it("fails closed when WeChat login is not configured", async () => {
    vi.stubEnv("WECHAT_APP_ID", "");
    vi.stubEnv("WECHAT_APP_SECRET", "");
    const response = await wechatLogin(
      new Request("http://127.0.0.1:4317/api/auth/wechat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "wx-login-code" }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("WECHAT_AUTH_NOT_CONFIGURED");
  });
});
