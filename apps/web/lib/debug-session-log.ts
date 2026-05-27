/** Opt-in session logger for tour-create investigations (local ingest server). */
const DEBUG_SESSION_INGEST_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEBUG_SESSION_INGEST_URL?.trim() ?? ""
    : "";

export function isDebugSessionLogEnabled(): boolean {
  return DEBUG_SESSION_INGEST_URL.length > 0;
}

export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "pre-fix",
): void {
  if (!isDebugSessionLogEnabled()) {
    return;
  }

  void fetch(DEBUG_SESSION_INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "53f494" },
    body: JSON.stringify({
      sessionId: "53f494",
      location,
      message,
      data,
      hypothesisId,
      runId,
      timestamp: Date.now(),
    }),
    keepalive: true,
  }).catch(() => {});
}

export function summarizeDenaliCreatePayload(dto: {
  transportModes?: unknown;
  tripDetails?: Record<string, unknown> | null;
  autoAcceptRegistrations?: boolean;
  requiresPayment?: boolean;
  lifecycle_status?: string;
}): Record<string, unknown> {
  const logistics =
    dto.tripDetails != null && typeof dto.tripDetails === "object"
      ? (dto.tripDetails.logistics as Record<string, unknown> | undefined)
      : undefined;
  const photos =
    dto.tripDetails != null && typeof dto.tripDetails === "object"
      ? (dto.tripDetails.photos as unknown[] | undefined)
      : undefined;
  const photoUrls = Array.isArray(photos)
    ? photos
        .map((p) =>
          p != null && typeof p === "object" && "url" in p ? String((p as { url: unknown }).url) : "",
        )
        .filter(Boolean)
    : [];
  const blobPhotoCount = photoUrls.filter((u) => u.startsWith("blob:")).length;
  const httpPhotoCount = photoUrls.filter((u) => u.startsWith("http")).length;

  return {
    lifecycle_status: dto.lifecycle_status,
    transportModes: dto.transportModes,
    primaryTransportMode: logistics?.primaryTransportMode,
    transportMode: logistics?.transportMode,
    autoAcceptRegistrations: dto.autoAcceptRegistrations,
    requiresPayment: dto.requiresPayment,
    photoCount: photoUrls.length,
    blobPhotoCount,
    httpPhotoCount,
    hasTripDetails: dto.tripDetails != null,
    denaliTourKind: (dto.tripDetails?.overview as Record<string, unknown> | undefined)?.denaliTourKind,
  };
}

/**
 * Lightweight deep-equality helper used by Denali sync-loop guard.
 * Keeps comparisons deterministic without adding external dependencies.
 */
export function deepEqualForLoopDebug(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (a == null || b == null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqualForLoopDebug(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (typeof a === "object") {
    if (typeof b !== "object") {
      return false;
    }
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) {
        return false;
      }
      if (!deepEqualForLoopDebug(aObj[key], bObj[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}
