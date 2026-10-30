import { NextResponse } from "next/server";
import { publicAuthConfig } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(publicAuthConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
