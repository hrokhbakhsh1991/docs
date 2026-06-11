"use client";

import React from "react";
import { useTranslations } from "next-intl";

import { resolveWorkspaceDraftIndexCount } from "./workspace-draft-index-logic";
import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";

export const WORKSPACE_DRAFT_INDEX_TEST_IDS = {
  summary: "workspace-draft-index-summary",
} as const;

type WorkspaceDraftIndexSummaryProps = {
  readonly items: readonly WorkspaceDraftIndexItem[];
  readonly loading?: boolean;
  readonly currentDraftKey?: string;
};

export function WorkspaceDraftIndexSummary({
  items,
  loading = false,
  currentDraftKey,
}: WorkspaceDraftIndexSummaryProps) {
  const t = useTranslations("wizard.host.draftIndex");

  if (loading || items.length === 0) {
    return null;
  }

  const count = resolveWorkspaceDraftIndexCount(items, currentDraftKey);

  return (
    <p
      className="workspace-draft-index-summary"
      data-testid={WORKSPACE_DRAFT_INDEX_TEST_IDS.summary}
      data-workspace-draft-count={count}
    >
      {t("summary", { count })}
    </p>
  );
}
