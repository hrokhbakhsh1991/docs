"use client";

import { SettingsPageHeader } from "@/admin/patterns/settings-page-header";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceDraftIndex } from "@/draft/use-workspace-draft-index";
import { WIZARD_DRAFT_AUDIT_TEST_IDS } from "@/draft/workspace-draft-audit-logic";
import { WorkspaceDraftAuditRow } from "@/draft/workspace-draft-audit-row";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import { useAppSession } from "@/providers/app-session-context";

export function WizardDraftsSettingsClient() {
  const session = useAppSession();
  const t = useTranslations("settings.wizardDrafts");
  const tErrors = useTranslations("settings.errors");
  const { items, loading, error } = useWorkspaceDraftIndex(session.workspaceId);

  return (
    <div className="space-y-6" data-testid={WIZARD_DRAFT_AUDIT_TEST_IDS.page}>
      <SettingsPageHeader title={t("title")} description={t("subtitle")} />

      {loading ? <Skeleton className="h-32 w-full" /> : null}
      {error !== null ? (
        <p className="text-sm text-destructive">
          {resolveCodedErrorMessage(tErrors, error.message)}
        </p>
      ) : null}

      <Card data-operator-surface="card" className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("listTitle", { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent
          className="space-y-3"
          data-testid={WIZARD_DRAFT_AUDIT_TEST_IDS.list}
        >
          {!loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((item) => (
              <WorkspaceDraftAuditRow
                key={`${item.draftNamespace}:${item.draftKey}`}
                workspaceId={session.workspaceId}
                item={item}
              />
            ))
          )}
        </CardContent>
      </Card>

      <p>
        <Button type="button" variant="link" className="h-auto p-0" asChild>
          <Link href="/settings">{t("backToHub")}</Link>
        </Button>
      </p>
    </div>
  );
}
