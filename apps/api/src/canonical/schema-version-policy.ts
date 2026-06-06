/**
 * Workspace current canonical schema revision — Phase 6 migrateCanonical will bump per plugin.
 */
const WORKSPACE_SCHEMA_VERSION: Readonly<Record<string, number>> = {
  starter: 1,
  denali: 1,
};

export function resolveWorkspaceCurrentSchemaVersion(workspaceType: string): number {
  return WORKSPACE_SCHEMA_VERSION[workspaceType] ?? 1;
}
