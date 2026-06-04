/**
 * Phase 3.3 — bootstrap registry (no static `packages/workspaces/*` path imports).
 * Contract: returns published workspace packages only; Phase 4 replaces with host/tenant resolver.
 * @see docs/phase-3/phase-3-deferred-capabilities.md (GAP-3.3-04)
 */
import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

const STARTER_PLUGINS: readonly WorkspacePlugin[] = [getStarterWorkspacePlugin()];

export function listBootstrapWorkspacePlugins(): readonly WorkspacePlugin[] {
  return STARTER_PLUGINS;
}
