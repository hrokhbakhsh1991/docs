import { ApiError } from "@/lib/api-client";
import { getUIError } from "@/lib/errors/error-registry";
import { mapToUserMessage } from "@/lib/errors/mapToUserMessage";

function readRequestIdFromApiError(error: ApiError): string | undefined {
  const data = error.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const nested = (data as { error?: { requestId?: unknown } }).error;
  const id = nested?.requestId;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : undefined;
}

/**
 * User-facing wizard error text.
 * Tour activation / publish codes (`DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES`,
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
