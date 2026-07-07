import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveProductionCertificationForPlugin,
} from "@app-tour/workspace-sdk";

/** Operator scaffold — not offered in Super Admin club create catalog. */
const EXCLUDED_PLATFORM_CLUB_WORKSPACES = new Set(["starter"]);

function formatWorkspaceDisplayName(workspaceType: string): string {
  return workspaceType
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export type PlatformWorkspaceCatalogEntry = {
  readonly id: string;
  readonly types: readonly string[];
  readonly displayName: string;
  readonly productionTier: "stub" | "certified";
  readonly productionOnboardingAllowed: boolean;
};

/**
 * Returns platform workspace catalog for Super Admin (Phase H4 — certification-aware).
 * Registry-backed via workspace-sdk generated certification map.
 */
export function listPlatformWorkspaces(): PlatformWorkspaceCatalogEntry[] {
  return DEFAULT_WORKSPACE_TYPE_BINDINGS.filter(
    (binding) => !EXCLUDED_PLATFORM_CLUB_WORKSPACES.has(binding.workspaceType)
  ).map((binding) => {
    const productionTier = resolveProductionCertificationForPlugin(binding.pluginId);
    return {
      id: binding.workspaceType,
      types: [binding.workspaceType],
      displayName: formatWorkspaceDisplayName(binding.workspaceType),
      productionTier,
      productionOnboardingAllowed: productionTier === "certified",
    };
  });
}
