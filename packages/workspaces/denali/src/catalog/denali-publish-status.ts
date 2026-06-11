import type { CanonicalDocument } from "@app-tour/workspace-sdk";

function readPublishStatus(canonical: CanonicalDocument): unknown {
  const data = canonical.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  return (data as Record<string, unknown>).publishStatus;
}

/** Public catalog visibility — canonical `publishStatus: active` only. */
export function isDenaliTourPublished(canonical: CanonicalDocument): boolean {
  return readPublishStatus(canonical) === "active";
}
