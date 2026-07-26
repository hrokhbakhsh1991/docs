import type { ReactNode } from "react";

import {
  loadWorkspaceHostProbeView,
  WorkspaceHostProbeMissingError,
} from "@/bootstrap/load-workspace-host-probe";
import {
  WorkspacePluginNotFoundError,
  WorkspaceContextMissingError,
} from "@/bootstrap/workspace-plugin-context-errors";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ readonly pluginId?: string | string[] }>;

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

/**
 * Thin Shell Phase 4s — generic capability stub route.
 * Renders `plugin.capabilities.hostProbe` for any admitted pluginId.
 * No product switches / defaults — pass `?pluginId=`.
 */
export default async function WorkspaceHostProbePage({
  searchParams,
}: {
  readonly searchParams: SearchParams;
}): Promise<ReactNode> {
  const params = await searchParams;
  const pluginId = firstQueryValue(params.pluginId)?.trim();

  if (!pluginId) {
    return (
      <main data-testid="workspace-host-probe-missing-id">
        <h1>Workspace host probe</h1>
        <p>Missing required query parameter: pluginId</p>
      </main>
    );
  }

  try {
    const view = await loadWorkspaceHostProbeView(pluginId);
    return (
      <main data-testid="workspace-host-probe" data-plugin-id={view.pluginId}>
        <h1>{view.title}</h1>
        <p>{view.body}</p>
        <p data-testid="workspace-host-probe-plugin-id">{view.pluginId}</p>
      </main>
    );
  } catch (error) {
    if (error instanceof WorkspaceContextMissingError) {
      return (
        <main data-testid="workspace-host-probe-missing-id">
          <h1>Workspace host probe</h1>
          <p>Missing required query parameter: pluginId</p>
        </main>
      );
    }
    if (error instanceof WorkspacePluginNotFoundError) {
      return (
        <main data-testid="workspace-host-probe-not-found" data-plugin-id={pluginId}>
          <h1>Workspace host probe</h1>
          <p>Unknown pluginId</p>
        </main>
      );
    }
    if (error instanceof WorkspaceHostProbeMissingError) {
      return (
        <main data-testid="workspace-host-probe-capability-missing" data-plugin-id={pluginId}>
          <h1>Workspace host probe</h1>
          <p>Host probe capability not published for this plugin</p>
        </main>
      );
    }
    throw error;
  }
}
