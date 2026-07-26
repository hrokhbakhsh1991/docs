import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE } from "@/wizard/platform-wizard-draft-binding";

import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";

export const WIZARD_DRAFT_AUDIT_TEST_IDS = {
  page: "operator-settings-wizard-drafts-page",
  list: "operator-settings-wizard-drafts-list",
  row: "operator-settings-wizard-draft-row",
  resume: "operator-settings-wizard-draft-resume",
} as const;

/**
 * Thin Shell Phase 3a — product-blind resume: platform wizard namespace + create draft key suffix.
 * Avoids hardcoding workspace create draft key literals (match `*-create` suffix).
 */
export function resolveWorkspaceDraftResumeHref(item: WorkspaceDraftIndexItem): string | null {
  if (
    item.draftNamespace === PLATFORM_OPERATOR_WIZARD_DRAFT_NAMESPACE &&
    item.draftKey.endsWith("-create")
  ) {
    return OPERATOR_WIZARD_PATH;
  }
  return null;
}

export function formatWorkspaceDraftAuditLabel(item: WorkspaceDraftIndexItem): string {
  return `${item.draftNamespace} / ${item.draftKey}`;
}
