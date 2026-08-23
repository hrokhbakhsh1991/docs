import type { WorkspaceLifecycleContract } from "../plugin/workspace-lifecycle";

/**
 * Neutral bucket for interpreting workspace publish wire labels against plugin lifecycle.
 * Not a global tour state enum — maps to WorkspaceLifecycleContract.publishStatus or initialStatus.
 */
export type TourPublishVisibilityBucket = "published" | "notPublished";

/**
 * Manifest-declared wire-label table (CW3-05). Labels are workspace canonical strings — not normalized.
 */
export type WorkspacePublishLabelMapping = {
  readonly publishedLabels: readonly string[];
  readonly notPublishedLabels: readonly string[];
  /**
   * DEC-CW-02 Option B — archive is optional workspace capability, not generic lifecycle state.
   * When true, `optionalArchiveLabels` are documented archive wire labels mapped to notPublished.
   */
  readonly archiveCapability?: boolean;
  readonly optionalArchiveLabels?: readonly string[];
};

function labelInSet(label: string, labels: readonly string[]): boolean {
  for (const candidate of labels) {
    if (candidate === label) {
      return true;
    }
  }
  return false;
}

/**
 * Map one workspace wire label to a neutral visibility bucket.
 * Returns undefined for missing label or label outside the manifest table (fail-closed).
 */
export function mapPublishLabelToVisibilityBucket(
  label: string | undefined,
  mapping: WorkspacePublishLabelMapping,
): TourPublishVisibilityBucket | undefined {
  if (label === undefined) {
    return undefined;
  }
  if (labelInSet(label, mapping.publishedLabels)) {
    return "published";
  }
  if (labelInSet(label, mapping.notPublishedLabels)) {
    return "notPublished";
  }
  if (
    mapping.archiveCapability === true &&
    mapping.optionalArchiveLabels !== undefined &&
    labelInSet(label, mapping.optionalArchiveLabels)
  ) {
    return "notPublished";
  }
  return undefined;
}

/** Resolve plugin lifecycle status string from neutral bucket. */
export function resolveLifecycleStatusFromVisibilityBucket(
  bucket: TourPublishVisibilityBucket,
  lifecycle: WorkspaceLifecycleContract,
): string {
  return bucket === "published" ? lifecycle.publishStatus : lifecycle.initialStatus;
}
