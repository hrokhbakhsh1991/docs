import type { WorkspaceAuthSurface } from "@app-tour/workspace-sdk";

export type UrbanOwnerSurface =
  | "urban.settings.read"
  | "urban.settings.update"
  | "urban.catalog.admin.read"
  | "urban.catalog.admin.update"
  | "urban.catalog.admin.delete"
  | "urban.catalog.publish"
  | "urban.catalog.unpublish"
  | "urban.tour.publish_fields";

export const URBAN_OWNER_SURFACE_ALLOWLIST: ReadonlySet<UrbanOwnerSurface> = new Set([
  "urban.settings.read",
  "urban.settings.update",
  "urban.catalog.admin.read",
  "urban.catalog.admin.update",
  "urban.catalog.admin.delete",
  "urban.catalog.publish",
  "urban.catalog.unpublish",
  "urban.tour.publish_fields",
]);

export function isUrbanOwnerSurface(surface: WorkspaceAuthSurface): surface is UrbanOwnerSurface {
  return URBAN_OWNER_SURFACE_ALLOWLIST.has(surface as UrbanOwnerSurface);
}
