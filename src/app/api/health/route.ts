import { NextResponse } from "next/server";
import { getAiConfig } from "@/lib/deepseek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ai = getAiConfig();
  return NextResponse.json({
    app: "FlowBack",
    ai: {
      configured: ai.configured,
      model: ai.model,
      baseUrl: ai.baseUrl,
      vision: ai.vision,
      jsonMode: ai.jsonMode,
      thinking: ai.thinking,
      maxTokens: ai.maxTokens,
      timeoutMs: ai.timeoutMs,
      imageDetail: ai.imageDetail,
      // Never expose the key itself, not even its length.
    },
    demo: {
      available: true,
      label: "本地规则解析（示例模式，非 AI）",
      supportsImages: false,
    },
  });
}
