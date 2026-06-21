"use client";

import type { DraftSchemaIssue, DraftStatus } from "@app-tour/draft-engine";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export type DraftQuarantineBannerProps = {
  readonly status: DraftStatus;
  readonly schemaIssues?: readonly DraftSchemaIssue[];
  readonly canRevert?: boolean;
  readonly onRevert?: () => void;
  readonly className?: string;
};

/** Network quarantine — form stays editable; sync paused until gate passes (Phase 5A/5B). */
export function DraftQuarantineBanner({
  status,
  schemaIssues,
  canRevert = false,
  onRevert,
  className,
}: DraftQuarantineBannerProps) {
  const t = useTranslations("common");

  if (status !== "QUARANTINED") {
    return null;
  }

  const codes =
    schemaIssues != null && schemaIssues.length > 0
      ? schemaIssues.map((issue) => issue.code).join(", ")
      : null;

  return (
    <div
      role="alert"
      className={className}
      data-testid="draft-quarantine-banner"
      data-draft-sync-status={status}
    >
      <p>{t("draftSync.quarantined")}</p>
      {codes != null ? (
        <p className="text-sm opacity-90" data-draft-schema-issue-codes>
          {codes}
        </p>
      ) : null}
      {canRevert && onRevert != null ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          data-testid="draft-quarantine-revert"
          onClick={onRevert}
        >
          {t("draftSync.revertQuarantine")}
        </Button>
      ) : null}
    </div>
  );
}
