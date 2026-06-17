import type { DraftStatus } from "@app-tour/draft-engine";
import type { BadgeVariant } from "@app-tour/ui-primitives/badge";

export type DraftSyncIndicatorView = {
  readonly variant: BadgeVariant;
  readonly messageKey: string;
  readonly visible: boolean;
  readonly showRetry: boolean;
};

export function resolveDraftSyncIndicatorView(status: DraftStatus): DraftSyncIndicatorView {
  switch (status) {
    case "SYNCING":
      return {
        variant: "info",
        messageKey: "draftSync.syncing",
        visible: true,
        showRetry: false,
      };
    case "DIRTY":
      return {
        variant: "warning",
        messageKey: "draftSync.dirty",
        visible: true,
        showRetry: false,
      };
    case "ERROR":
      return {
        variant: "danger",
        messageKey: "draftSync.error",
        visible: true,
        showRetry: true,
      };
    case "QUARANTINED":
      return {
        variant: "danger",
        messageKey: "draftSync.quarantined",
        visible: true,
        showRetry: true,
      };
    case "DRAFT_AVAILABLE":
      return {
        variant: "info",
        messageKey: "draftSync.draftAvailable",
        visible: true,
        showRetry: false,
      };
    case "CONFLICT_RESOLVING":
      return {
        variant: "warning",
        messageKey: "draftSync.conflictResolving",
        visible: true,
        showRetry: false,
      };
    case "IDLE":
    default:
      return {
        variant: "success",
        messageKey: "draftSync.idle",
        visible: false,
        showRetry: false,
      };
  }
}
