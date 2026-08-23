/** Workspace publish labels that mean "publicly visible". */
export function isPublicPublishStatusLabel(label: string | undefined): boolean {
  if (label === undefined) {
    return false;
  }
  const normalized = label.trim().toLowerCase();
  return normalized === "active" || normalized === "published";
}

/**
 * `tours.publish_status` still uses the legacy row vocabulary enforced by Postgres.
 * Canonical workspace labels such as `active` must be normalized before persistence.
 */
export function normalizeStoredTourPublishStatus(label: string | undefined): "draft" | "published" {
  return isPublicPublishStatusLabel(label) ? "published" : "draft";
}
