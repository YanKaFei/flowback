import { describe, expect, it } from "vitest";
import { decodeImageDataUrl, ImageValidationError } from "@/lib/uploads";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const JPEG_PREFIX =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

function image(dataUrl: string, mime: "image/png" | "image/jpeg" = "image/png") {
  return { name: "chat.png", mime, dataUrl };
}

describe("image validation", () => {
  it("accepts a valid PNG data url", () => {
    const buffer = decodeImageDataUrl(image(PNG));
    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("hex")).toBe("89504e47");
  });

  it("accepts a valid JPEG data url", () => {
    const buffer = decodeImageDataUrl(image(JPEG_PREFIX, "image/jpeg"));
    expect(buffer[0]).toBe(0xff);
    expect(buffer[1]).toBe(0xd8);
  });

  it("rejects a mime mismatch", () => {
    expect(() => decodeImageDataUrl(image(PNG, "image/jpeg"))).toThrow(
      ImageValidationError,
    );
  });

  it("rejects content whose magic bytes do not match", () => {
    const fakeJpeg =
      "data:image/jpeg;base64," + Buffer.from("not an image at all").toString("base64");
    expect(() => decodeImageDataUrl(image(fakeJpeg, "image/jpeg"))).toThrow(
      /格式不符/,
    );
  });

  it("rejects an invalid data url", () => {
    expect(() =>
      decodeImageDataUrl(image("data:text/plain;base64,aGVsbG8=")),
    ).toThrow(ImageValidationError);
  });
});
