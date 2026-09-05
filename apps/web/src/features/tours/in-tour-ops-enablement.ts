/**
 * ITO-001 — resolve in-tour operations UI manifest from workspace plugin capability.
 * Mirrors finance nav enablement (fail-closed when capability missing).
 */
import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export type InTourOpsPanels = {
  readonly groups: boolean;
  readonly checklists: boolean;
  readonly incidentLog: boolean;
};

export type InTourOpsUiManifest = {
  readonly enabled: boolean;
  readonly panels: InTourOpsPanels;
};

const DEFAULT_MANIFEST: InTourOpsUiManifest = Object.freeze({
  enabled: false,
  panels: Object.freeze({
    groups: false,
    checklists: false,
    incidentLog: false,
  }),
});

type InTourOpsCapability = {
  readonly resolveManifest?: (theme?: unknown | null) => InTourOpsUiManifest & { readonly version?: string };
};

type PluginWithInTourOps = {
  readonly capabilities?: {
    readonly inTourOps?: InTourOpsCapability;
  };
};

function normalizeManifest(raw: InTourOpsUiManifest & { readonly version?: string }): InTourOpsUiManifest {
  return Object.freeze({
    enabled: raw.enabled === true,
    panels: Object.freeze({
      groups: raw.panels?.groups === true,
      checklists: raw.panels?.checklists === true,
      incidentLog: raw.panels?.incidentLog === true,
    }),
  });
}

/**
 * Returns null when workspace does not expose in-tour operations (hide tab).
 */
export async function resolveInTourOpsForHub(
  theme: unknown | null,
  pluginId: string,
): Promise<InTourOpsUiManifest | null> {
  if (pluginId.trim().length === 0) {
    return null;
  }
  try {
    const plugin = (await loadBootstrapWorkspacePlugin(pluginId)) as PluginWithInTourOps;
    const capability = plugin.capabilities?.inTourOps;
    if (capability?.resolveManifest == null) {
      return null;
    }
    return normalizeManifest(capability.resolveManifest(theme));
  } catch {
    return null;
  }
}

export function disabledInTourOpsManifest(): InTourOpsUiManifest {
  return DEFAULT_MANIFEST;
}
