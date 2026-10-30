import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, UPLOAD_DIR } from "./db";
import type { StoredImage } from "./repo";
import {
  MAX_IMAGE_BYTES,
  type ImageInput,
} from "./schemas";

export class ImageValidationError extends Error {
  code: string;
  constructor(message: string, code = "IMAGE_INVALID") {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function magicMatches(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

/** Decode a data URL, enforce format + size, and verify magic bytes. */
export function decodeImageDataUrl(image: ImageInput): Buffer {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    image.dataUrl,
  );
  if (!match) {
    throw new ImageValidationError(
      `「${image.name}」不是有效的 base64 图片 Data URL。`,
    );
  }
  const declaredMime = match[1];
  if (declaredMime !== image.mime) {
    throw new ImageValidationError(
      `「${image.name}」声明的格式与 Data URL 不一致。`,
    );
  }
  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    throw new ImageValidationError(`「${image.name}」图片内容为空。`);
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `「${image.name}」超过 5 MB 上限（当前 ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB）。`,
      "IMAGE_TOO_LARGE",
    );
  }
  if (!magicMatches(buffer, image.mime)) {
    throw new ImageValidationError(
      `「${image.name}」文件内容与 ${image.mime} 格式不符。`,
    );
  }
  return buffer;
}

/** Persist screenshots next to the SQLite file, keyed by source id. */
export async function saveSourceImages(
  sourceId: string,
  images: ImageInput[],
): Promise<StoredImage[]> {
  if (images.length === 0) return [];
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const dir = path.join(UPLOAD_DIR, sourceId);
  await fs.mkdir(dir, { recursive: true });

  const stored: StoredImage[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const buffer = decodeImageDataUrl(image);
    const ext = EXT_BY_MIME[image.mime];
    const filename = `${index}.${ext}`;
    const absolute = path.join(dir, filename);
    await fs.writeFile(absolute, buffer);
    stored.push({
      path: path.relative(DATA_DIR, absolute),
      name: image.name,
      mime: image.mime,
    });
  }
  return stored;
}

export async function readStoredImage(relativePath: string): Promise<Buffer | null> {
  const resolved = path.resolve(DATA_DIR, relativePath);
  const root = path.resolve(DATA_DIR);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  try {
    return await fs.readFile(resolved);
  } catch {
    return null;
  }
}
