import { notFound } from "next/navigation";
import { getAiConfig } from "@/lib/deepseek";
import { getProjectBundle } from "@/lib/repo";
import { AUTH_LOCAL_USER_ID } from "@/lib/db";
import { RisksClient } from "@/components/risks-client";

export const dynamic = "force-dynamic";

export default async function RisksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const bundle = getProjectBundle(projectId, AUTH_LOCAL_USER_ID);
  if (!bundle) notFound();
  const ai = getAiConfig();

  return (
    <RisksClient
      project={bundle.project}
      tasks={bundle.tasks}
      risks={bundle.risks}
      aiConfigured={ai.configured}
      model={ai.model}
    />
  );
}
