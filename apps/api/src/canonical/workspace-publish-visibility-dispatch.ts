import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { WORKSPACE_PUBLISH_VISIBILITY_BINDINGS } from "./workspace-publish-visibility-bindings.generated";

type PublishVisibilityBinding = (typeof WORKSPACE_PUBLISH_VISIBILITY_BINDINGS)[number];

function buildBindingMap(): Readonly<Record<string, PublishVisibilityBinding>> {
  const map: Record<string, PublishVisibilityBinding> = {};
  for (const binding of WORKSPACE_PUBLISH_VISIBILITY_BINDINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

/**
 * Manifest-bound dispatch: is this tour publicly visible on catalog/registration surfaces?
 * Fail-closed when workspace binding is missing — no Denali fallback.
 */
export function isTourPubliclyVisible(
  workspaceType: string | undefined,
  canonical: CanonicalDocument,
): boolean {
  if (workspaceType === undefined) {
    return false;
  }
  const binding = bindingsByWorkspaceType[workspaceType];
  if (binding === undefined) {
    return false;
  }
  return binding.isTourPubliclyVisible(canonical);
}
