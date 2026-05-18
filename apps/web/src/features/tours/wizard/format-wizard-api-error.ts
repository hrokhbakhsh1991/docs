import { ApiError } from "@/lib/api-client";

function readRequestIdFromApiError(error: ApiError): string | undefined {
  const data = error.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const nested = (data as { error?: { requestId?: unknown } }).error;
  const id = nested?.requestId;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : undefined;
}

/** User-facing wizard error text; appends API `requestId` when present for support correlation. */
export function formatWizardApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const requestId = readRequestIdFromApiError(error);
    if (requestId) {
      return `${error.message} (شناسه درخواست: ${requestId})`;
    }
    return error.message;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return fallback;
}
