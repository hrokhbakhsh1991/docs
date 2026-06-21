/** P3-B — closed allowlist for generic `platform.*` composite renderer ids (P3-C publish reuses). */

export const PLATFORM_GENERIC_RENDERER_IDS = [
  "platform.photos",
  "platform.location",
  "platform.itinerary",
] as const;

export type PlatformGenericRendererId = (typeof PLATFORM_GENERIC_RENDERER_IDS)[number];

const ALLOWED_RENDERER_ID_SET = new Set<string>(PLATFORM_GENERIC_RENDERER_IDS);

export class WorkspaceMetadataValidationError extends Error {
  readonly code = "WORKSPACE_METADATA_RENDERER_NOT_ALLOWED" as const;

  constructor(readonly rendererId: string) {
    super(`WORKSPACE_METADATA_RENDERER_NOT_ALLOWED:${rendererId}`);
    this.name = "WorkspaceMetadataValidationError";
  }
}

export function isAllowedPlatformRendererId(id: string): boolean {
  return ALLOWED_RENDERER_ID_SET.has(id.trim());
}

export function assertAllowedPlatformRendererId(id: string): void {
  const normalized = id.trim();
  if (!ALLOWED_RENDERER_ID_SET.has(normalized)) {
    throw new WorkspaceMetadataValidationError(normalized);
  }
}
