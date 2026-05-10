import type { ApiError } from "@/lib/api-client";

/** Backend codes for `tripDetails` workspace catalog validation (400). */
export const TENANT_CATALOG_ERROR_CODES = {
  EQUIPMENT: "INVALID_EQUIPMENT_IDS_FOR_TENANT",
  TOUR_THEMES: "INVALID_TOUR_THEME_IDS_FOR_TENANT",
  GUIDE_LANGUAGES: "INVALID_GUIDE_LANGUAGE_IDS_FOR_TENANT",
} as const;

/**
 * Keys under the next-intl namespace `tours.catalogErrors` (see messages/en.json & fa.json).
 * UI maps `error.code` → localized string via `useTranslations("tours.catalogErrors")`.
 */
export const TENANT_CATALOG_MESSAGE_KEYS = [
  "invalidEquipmentIdsTenant",
  "invalidTourThemeIdsTenant",
  "invalidGuideLanguageIdsTenant",
  "genericInvalidCatalogTenant",
] as const;

export type TenantCatalogMessageKey = (typeof TENANT_CATALOG_MESSAGE_KEYS)[number];

type ErrorEnvelope = {
  error?: {
    code?: unknown;
    invalidIds?: unknown;
  };
};

/**
 * Reads optional `invalidIds` from the API error body (`error.data` on {@link ApiError}).
 * Shape matches `{ error: { code, message, invalidIds?: string[] } }`.
 */
export function parseTenantCatalogErrorPayload(data: unknown): {
  code?: string;
  invalidIds: string[];
} {
  if (data == null || typeof data !== "object") {
    return { invalidIds: [] };
  }
  const envelope = data as ErrorEnvelope;
  const err = envelope.error;
  if (!err || typeof err !== "object") {
    return { invalidIds: [] };
  }
  const code = typeof err.code === "string" && err.code.trim() ? err.code.trim() : undefined;
  const raw = err.invalidIds;
  const invalidIds = Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  return { code, invalidIds };
}

/**
 * When `code` is a known tenant-catalog mismatch, returns the i18n message key; otherwise
 * matches generic `INVALID_*_IDS_FOR_TENANT` and returns the generic catalog hint key.
 */
export function getCatalogErrorMessageKey(code: string | undefined): TenantCatalogMessageKey | null {
  if (!code) {
    return null;
  }
  switch (code) {
    case TENANT_CATALOG_ERROR_CODES.EQUIPMENT:
      return "invalidEquipmentIdsTenant";
    case TENANT_CATALOG_ERROR_CODES.TOUR_THEMES:
      return "invalidTourThemeIdsTenant";
    case TENANT_CATALOG_ERROR_CODES.GUIDE_LANGUAGES:
      return "invalidGuideLanguageIdsTenant";
    default:
      if (code.startsWith("INVALID_") && code.endsWith("_IDS_FOR_TENANT")) {
        return "genericInvalidCatalogTenant";
      }
      return null;
  }
}

/** Dev-only: logs invalid catalog UUIDs without exposing them in the UI. */
export function logTenantCatalogMismatchDev(apiError: ApiError): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const { invalidIds } = parseTenantCatalogErrorPayload(apiError.data);
  if (invalidIds.length > 0) {
    console.warn("[tour] workspace catalog reference rejected", {
      code: apiError.code,
      invalidIds,
    });
  }
}
