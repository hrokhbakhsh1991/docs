import type { DraftStatus } from "@app-tour/draft-engine";

export type DraftManualSyncAction = "flush" | "retry" | "none";

export type DraftManualSyncButtonView = {
  readonly action: DraftManualSyncAction;
  readonly labelKey: string;
  readonly labelNamespace: "wizard" | "common";
  readonly disabled: boolean;
};

/** Header Save draft control — ERROR routes to retry(); DIRTY routes to flush(). */
export function resolveDraftManualSyncButtonView(status: DraftStatus): DraftManualSyncButtonView {
  switch (status) {
    case "SYNCING":
      return {
        action: "none",
        labelKey: "savingDraft",
        labelNamespace: "wizard",
        disabled: true,
      };
    case "ERROR":
      return {
        action: "retry",
        labelKey: "draftSync.retry",
        labelNamespace: "common",
        disabled: false,
      };
    case "QUARANTINED":
      return {
        action: "retry",
        labelKey: "draftSync.retry",
        labelNamespace: "common",
        disabled: false,
      };
    case "DIRTY":
      return {
        action: "flush",
        labelKey: "saveDraft",
        labelNamespace: "wizard",
        disabled: false,
      };
    default:
      return {
        action: "none",
        labelKey: "saveDraft",
        labelNamespace: "wizard",
        disabled: true,
      };
  }
}
