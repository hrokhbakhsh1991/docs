/**
 * Stable workspace plugin identifier — distinct from {@link TourFormProfile}
 * (`packages/types/src/tour-form-profile.ts`).
 */
export type WorkspacePluginId = string;

/** Mock plugin id for Phase 1.2 contract tests. */
export const MOCK_WORKSPACE_PLUGIN_ID = "mock" as const satisfies WorkspacePluginId;
