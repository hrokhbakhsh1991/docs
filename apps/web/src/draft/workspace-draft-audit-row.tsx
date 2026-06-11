"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useWorkspaceDraftEvents } from "./use-workspace-draft-events";
import {
  formatWorkspaceDraftAuditLabel,
  resolveWorkspaceDraftResumeHref,
  WIZARD_DRAFT_AUDIT_TEST_IDS,
} from "./workspace-draft-audit-logic";
import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";
import { WorkspaceDraftEventsTimeline } from "./workspace-draft-events-timeline";

type WorkspaceDraftAuditRowProps = {
  readonly workspaceId: string;
  readonly item: WorkspaceDraftIndexItem;
};

export function WorkspaceDraftAuditRow({ workspaceId, item }: WorkspaceDraftAuditRowProps) {
  const t = useTranslations("settings.wizardDrafts");
  const [expanded, setExpanded] = useState(false);
  const events = useWorkspaceDraftEvents(
    expanded ? workspaceId : undefined,
    item.draftNamespace,
    item.draftKey
  );
  const resumeHref = resolveWorkspaceDraftResumeHref(item);

  return (
    <div
      className="rounded-lg border p-3"
      data-testid={WIZARD_DRAFT_AUDIT_TEST_IDS.row}
      data-workspace-draft-key={item.draftKey}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{formatWorkspaceDraftAuditLabel(item)}</p>
          <p className="text-xs text-muted-foreground">
            {t("rowMeta", {
              version: item.version,
              updatedAt: item.updatedAt,
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {resumeHref !== null ? (
            <Button type="button" variant="secondary" size="sm" asChild>
              <Link href={resumeHref} data-testid={WIZARD_DRAFT_AUDIT_TEST_IDS.resume}>
                {t("resumeWizard")}
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((value) => !value);
            }}
          >
            {expanded ? t("hideEvents") : t("showEvents")}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3">
          <WorkspaceDraftEventsTimeline items={events.items} loading={events.loading} />
        </div>
      ) : null}
    </div>
  );
}
