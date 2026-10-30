import { getAiConfig } from "@/lib/deepseek";
import { listProjects, type ProjectSummary } from "@/lib/repo";
import { AUTH_LOCAL_USER_ID } from "@/lib/db";
import { HomeClient } from "@/components/home-client";
import { safeError } from "@/lib/log";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  let projects: ProjectSummary[] = [];
  try {
    projects = listProjects(AUTH_LOCAL_USER_ID);
  } catch (error) {
    console.error("[flowback] failed to list projects", safeError(error));
  }
  const ai = getAiConfig();

  return (
    <HomeClient
      projects={projects}
      aiConfigured={ai.configured}
      model={ai.model}
      initialProjectId={params.project}
    />
  );
}
