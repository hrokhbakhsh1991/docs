import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import {
  OPERATOR_CREATE_TOUR_DRAFT_KEY,
  OPERATOR_WIZARD_DRAFT_NAMESPACE,
} from "@/wizard/draft-shell-runtime";

import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";

export const WIZARD_DRAFT_AUDIT_TEST_IDS = {
  page: "operator-settings-wizard-drafts-page",
  list: "operator-settings-wizard-drafts-list",
  row: "operator-settings-wizard-draft-row",
  resume: "operator-settings-wizard-draft-resume",
} as const;

export function resolveWorkspaceDraftResumeHref(item: WorkspaceDraftIndexItem): string | null {
  if (
    item.draftNamespace === OPERATOR_WIZARD_DRAFT_NAMESPACE &&
    item.draftKey === OPERATOR_CREATE_TOUR_DRAFT_KEY
  ) {
    return OPERATOR_WIZARD_PATH;
  }
  return null;
}

export function formatWorkspaceDraftAuditLabel(item: WorkspaceDraftIndexItem): string {
  return `${item.draftNamespace} / ${item.draftKey}`;
}
