import type { DraftStatus } from "@app-tour/draft-engine";

export type DraftConflictBannerView =
  | { readonly kind: "hidden" }
  | { readonly kind: "resolving" }
  | { readonly kind: "available"; readonly showActions: boolean }
  | { readonly kind: "serverReloaded" };

export function resolveDraftConflictBannerView(
  status: DraftStatus,
  hasPendingDraft: boolean,
  hasActions: boolean,
  conflictReloadNotice: boolean,
): DraftConflictBannerView {
  if (conflictReloadNotice) {
    return { kind: "serverReloaded" };
  }
  if (status === "CONFLICT_RESOLVING") {
    return { kind: "resolving" };
  }
  if (status === "DRAFT_AVAILABLE" && hasPendingDraft) {
    return { kind: "available", showActions: hasActions };
  }
  return { kind: "hidden" };
}
