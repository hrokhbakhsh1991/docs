/** Shape from {@link apps/api/src/common/errors/global-exception.filter.ts} */
type GlobalErrorEnvelope = {
  success?: false;
  requestId?: string;
  error?: { code?: string; message?: string; correlationId?: string; traceId?: string };
};

/** Legacy `{ error: { code, message } }` bodies from Nest `HttpException` */
type LegacyNestedError = { error?: { code?: string; message?: string } };

function extractMeApiError(payload: unknown): { code?: string; message?: string } | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const envelope = payload as GlobalErrorEnvelope & LegacyNestedError;
  const nested = envelope.error;
  if (!nested || typeof nested !== "object") {
    return null;
  }
  const message = typeof nested.message === "string" ? nested.message.trim() : "";
  const code = typeof nested.code === "string" ? nested.code.trim() : "";
  if (message === "" && code === "") {
    return null;
  }
  return { message: message === "" ? undefined : message, code: code === "" ? undefined : code };
}

export type TranslateSettings = (key: string) => string;

/** User-facing message for `/api/me` error JSON (global envelope or legacy nested `error`). */
export function pickMeErrorMessage(
  payload: unknown,
  fallback: string,
  tSettings: TranslateSettings
): string {
  const extracted = extractMeApiError(payload);
  if (extracted?.message && extracted.message.trim() !== "") {
    return extracted.message.trim();
  }
  if (extracted?.code && extracted.code !== "") {
    const key = `meErrors.${extracted.code}`;
    const translated = tSettings(key);
    if (translated !== key && translated.trim() !== "") {
      return translated.trim();
    }
  }
  return fallback;
}
