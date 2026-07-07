export type TourListCoverResolveResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly code: string };

/** Resolve MinIO-backed tour cover via operator BFF (same path as wizard photo preview). */
export async function resolveTourListCoverImageUrl(
  storageKey: string
): Promise<TourListCoverResolveResult> {
  const normalizedKey = storageKey.trim();
  if (normalizedKey.length === 0) {
    return { ok: false, code: "TOUR_COVER_KEY_REQUIRED" };
  }

  const params = new URLSearchParams({ storageKey: normalizedKey });
  const response = await fetch(`/api/tours/wizard-photos/url?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const nested = payload.error;
    const code =
      typeof nested === "object" &&
      nested !== null &&
      typeof (nested as Record<string, unknown>).code === "string"
        ? String((nested as Record<string, unknown>).code)
        : typeof payload.code === "string"
          ? payload.code
          : `TOUR_COVER_HTTP_${response.status}`;
    return { ok: false, code };
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (url.length === 0) {
    return { ok: false, code: "TOUR_COVER_URL_MISSING" };
  }
  return { ok: true, url };
}
