/** Maps API / patch failure codes to stable `tours.edit.errors` keys. */
export function mapTourPatchErrorCode(apiCode: string, httpStatus: number): string {
  const normalized = apiCode.trim();
  if (normalized === "AUTH_TOKEN_REVOKED") {
    return "TOUR_EDIT_AUTH_TOKEN_REVOKED";
  }
  if (normalized === "AUTH_UNAUTHENTICATED") {
    return "TOUR_EDIT_AUTH_UNAUTHENTICATED";
  }
  if (normalized.length > 0 && normalized.startsWith("TOUR_")) {
    return normalized;
  }
  return `TOUR_EDIT_HTTP_${httpStatus}`;
}
