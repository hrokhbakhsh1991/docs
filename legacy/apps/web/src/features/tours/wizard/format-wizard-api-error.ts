import { ApiError } from "@/lib/api-client";
import { getUIError } from "@/lib/errors/error-registry";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";

function readRequestIdFromApiError(error: ApiError): string | undefined {
  if (error.requestId?.trim()) {
    return error.requestId.trim();
  }
  const data = error.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const envelope = data as { requestId?: unknown; error?: { details?: { requestId?: unknown } } };
  if (typeof envelope.requestId === "string" && envelope.requestId.trim()) {
    return envelope.requestId.trim();
  }
  const detailsId = envelope.error?.details?.requestId;
  return typeof detailsId === "string" && detailsId.trim() !== "" ? detailsId.trim() : undefined;
}

/**
 * User-facing wizard error text.
 * Tour activation / publish codes (`OUTDOOR_PUBLISH_REQUIRES_GEOLOCATION_ZONES`,
 * `PAID_TOUR_REQUIRES_AMOUNT`, `INVALID_LIFECYCLE_TRANSITION`, …) resolve via {@link getUIError}
 * and Persian entries in `error-registry.ts`.
 */
export function formatWizardApiErrorMessage(error: unknown, fallback: string): string {
  let mapped: string;
  if (
    error instanceof ApiError &&
    error.code &&
    error.code !== "REQUEST_FAILED" &&
    error.code !== "NETWORK_ERROR"
  ) {
    mapped = getUIError(error.code).message;
  } else {
    mapped = mapToUserMessage(error, { fallback });
  }

  if (error instanceof ApiError) {
    const requestId = readRequestIdFromApiError(error);
    if (requestId) {
      return `${mapped} (شناسه درخواست: ${requestId})`;
    }
  }

  return mapped;
}
