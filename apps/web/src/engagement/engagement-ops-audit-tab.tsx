"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { AppLocale } from "@/i18n/routing";

import {
  ENGAGEMENT_OPS_TEST_IDS,
  buildEngagementAuditLogPath,
  formatEngagementTimestamp,
  isEngagementPermissionDenied,
} from "./engagement-ops-logic";
import type { EngagementAuditEntry, EngagementLoadState } from "./engagement-ops-types";
import { EngagementPanelState } from "./engagement-ops-ui-primitives";

export function EngagementAuditTab({ active }: { readonly active: boolean }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("engagement.ops");
  const [items, setItems] = useState<readonly EngagementAuditEntry[]>([]);
  const [state, setState] = useState<EngagementLoadState>("idle");

  const loadAudit = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(buildEngagementAuditLogPath(), { cache: "no-store" });
      if (isEngagementPermissionDenied(response.status)) {
        setState("permissionDenied");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const payload = (await response.json()) as { items?: readonly EngagementAuditEntry[] };
      setItems(payload.items ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    void loadAudit();
  }, [active, loadAudit]);

  const resolveEntityLabel = (entityType: EngagementAuditEntry["entityType"]): string => {
    const key = `auditEntity.${entityType}`;
    return t.has(key) ? t(key) : entityType;
  };

  return (
    <EngagementPanelState
      state={state}
      loadingLabel={t("auditLoading")}
      errorLabel={t("auditLoadFailed")}
      permissionDeniedLabel={t("permissionDenied")}
      emptyLabel={t("auditEmpty")}
      isEmpty={items.length === 0}
      testIds={{
        panel: ENGAGEMENT_OPS_TEST_IDS.auditPanel,
        empty: ENGAGEMENT_OPS_TEST_IDS.auditEmpty,
      }}
    >
      <div className="overflow-x-auto rounded-md border" data-testid={ENGAGEMENT_OPS_TEST_IDS.auditTable}>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-start">
            <tr>
              <th className="px-3 py-2 font-medium">{t("auditColumnTime")}</th>
              <th className="px-3 py-2 font-medium">{t("auditColumnActor")}</th>
              <th className="px-3 py-2 font-medium">{t("auditColumnEntity")}</th>
              <th className="px-3 py-2 font-medium">{t("auditColumnAction")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  <time dateTime={entry.createdAt}>
                    {formatEngagementTimestamp(entry.createdAt, locale)}
                  </time>
                </td>
                <td className="px-3 py-2">
                  <span className="text-muted-foreground">{entry.actorRole}</span>
                  <span className="ms-2 font-mono text-xs" dir="ltr">
                    {entry.actorUserId.slice(0, 8)}
                  </span>
                </td>
                <td className="px-3 py-2">{resolveEntityLabel(entry.entityType)}</td>
                <td className="px-3 py-2">{entry.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </EngagementPanelState>
  );
}
