import { notFound } from "next/navigation";
import { isAiConfigured } from "@/lib/deepseek";
import { getExtractionDetail } from "@/lib/repo";
import { AUTH_LOCAL_USER_ID } from "@/lib/db";
import { ReviewClient } from "@/components/review-client";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ extractionId: string }>;
}) {
  const { extractionId } = await params;
  const detail = getExtractionDetail(extractionId, AUTH_LOCAL_USER_ID);
  if (!detail) notFound();

  const { extraction, source, project } = detail;

  return (
    <ReviewClient
      project={{ id: project.id, name: project.name }}
      source={{
        id: source.id,
        kind: source.kind,
        rawText: source.rawText,
        images: source.images.map((image) => ({
          name: image.name,
          mime: image.mime,
        })),
        mode: source.mode,
        model: source.model,
        createdAt: source.createdAt,
      }}
      extraction={{
        id: extraction.id,
        status: extraction.status,
        summary: extraction.summary,
        payload: extraction.payload,
        warnings: extraction.warnings,
        mode: extraction.mode,
        model: extraction.model,
        createdAt: extraction.createdAt,
      }}
      aiConfigured={isAiConfigured()}
    />
  );
}
