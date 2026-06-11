import { INTL_LOCALE, toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";

import type { AuditTrailEvent, AuditTrailListResponse } from "./audit-trail-types";

export function parseAuditTrailResponse(payload: unknown): AuditTrailListResponse {
  if (payload === null || typeof payload !== "object") {
    return { items: [], total: 0 };
  }
  const record = payload as Record<string, unknown>;
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems
    .filter((item): item is AuditTrailEvent => isAuditTrailEvent(item))
    .map((item) => ({ ...item }));
  const total = typeof record.total === "number" ? record.total : items.length;
  return { items, total };
}

function isAuditTrailEvent(value: unknown): value is AuditTrailEvent {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.tenantId === "string" &&
    typeof row.occurredAt === "string" &&
    typeof row.actorUserId === "string" &&
    typeof row.action === "string" &&
    typeof row.resourceType === "string" &&
    typeof row.resourceId === "string" &&
    typeof row.summary === "string"
  );
}

export function formatAuditOccurredAt(iso: string, locale: AppLocale = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return toLocalizedDigits(
    date.toLocaleString(INTL_LOCALE[locale], {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    locale
  );
}
