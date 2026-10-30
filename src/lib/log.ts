/** Redact credentials and inline screenshots before an error reaches logs. */
export function redactForLog(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-key]")
    .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/gi, "[redacted-image]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(secret|js_code|code|openid)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}

export function safeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redactForLog(error.message || "Unknown error"),
    };
  }
  return { name: "UnknownError", message: "Unknown error" };
}
