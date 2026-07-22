"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppLocale } from "@/i18n/routing";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import {
  formatAuditOccurredAt,
  parseAuditTrailResponse,
} from "@/features/settings/audit-trail-logic";
import {
  AUDIT_TRAIL_TEST_IDS,
  type AuditTrailEvent,
} from "@/features/settings/audit-trail-types";

export function AuditTrailClient() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("settings.auditTrail");
  const tErrors = useTranslations("settings.errors");
  const [items, setItems] = useState<readonly AuditTrailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/explore/audit_trail", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`AUDIT_TRAIL_HTTP_${response.status}`);
        }
        return parseAuditTrailResponse(await response.json());
      })
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "AUDIT_TRAIL_FETCH_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6" data-testid={AUDIT_TRAIL_TEST_IDS.page}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-sm" data-testid={AUDIT_TRAIL_TEST_IDS.list}>
        <CardHeader>
          <CardTitle>{t("eventsTitle", { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border p-3"
                data-testid={AUDIT_TRAIL_TEST_IDS.row}
                data-event-id={item.id}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{item.summary}</p>
                  <time className="text-xs text-muted-foreground" dateTime={item.occurredAt}>
                    {formatAuditOccurredAt(item.occurredAt, locale)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.action} · {item.resourceType}/{item.resourceId}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}