import { getSource } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { readStoredImage } from "@/lib/uploads";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; index: string }> };

export async function GET(request: Request, { params }: Params) {
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, index } = await params;
  const source = getSource(id, auth.user.id);
  if (!source) {
    return jsonError(404, "SOURCE_NOT_FOUND", "来源不存在。");
  }
  const imageIndex = Number.parseInt(index, 10);
  const image = source.images[imageIndex];
  if (!Number.isInteger(imageIndex) || !image) {
    return jsonError(404, "IMAGE_NOT_FOUND", "截图不存在。");
  }

  const buffer = await readStoredImage(image.path);
  if (!buffer) {
    return jsonError(404, "IMAGE_FILE_MISSING", "截图文件已丢失。");
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
