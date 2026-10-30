import { notFound } from "next/navigation";
import { getAiConfig } from "@/lib/deepseek";
import { getProjectBundle } from "@/lib/repo";
import { AUTH_LOCAL_USER_ID } from "@/lib/db";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const bundle = getProjectBundle(projectId, AUTH_LOCAL_USER_ID);
  if (!bundle) notFound();
  const ai = getAiConfig();

  return (
    <DashboardClient
      bundle={bundle}
      aiConfigured={ai.configured}
      model={ai.model}
      created={query.created === "1"}
    />
  );
}
