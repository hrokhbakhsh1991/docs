import { ApiError } from "@/lib/api-client";

export function formatQuickAddApiError(error: unknown, fallback = "ذخیره انجام نشد. دوباره تلاش کنید."): string {
  if (error instanceof ApiError) {
    const body = error.data as { error?: { message?: unknown } } | undefined;
    const nested = body?.error?.message;
    if (typeof nested === "string" && nested.trim() !== "") {
      return nested.trim();
    }
    if (error.message.trim() !== "") {
      return error.message.trim();
    }
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message.trim();
  }
  return fallback;
}
