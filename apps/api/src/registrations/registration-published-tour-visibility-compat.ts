import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { isTourPubliclyVisible } from "../canonical/workspace-publish-visibility-dispatch";
import { WORKSPACE_PUBLISH_VISIBILITY_BINDINGS } from "../canonical/workspace-publish-visibility-bindings.generated";

type PublishVisibilityBinding = (typeof WORKSPACE_PUBLISH_VISIBILITY_BINDINGS)[number];

function resolveGeneratedBinding(workspaceType: string): PublishVisibilityBinding | undefined {
  for (const binding of WORKSPACE_PUBLISH_VISIBILITY_BINDINGS) {
    if (binding.workspaceType === workspaceType) {
      return binding;
    }
  }
  return undefined;
}

/**
 * CW3-04 compat — codegen publish-visibility binding predicate (retained until census zero).
 * Parity proofs only; registration services use manifest-bound `*-registration-tour-publish-visibility` modules.
 */
export function isRegistrationTourPublishedViaGeneratedBinding(
  workspaceType: string,
  canonical: CanonicalDocument,
): boolean {
  const binding = resolveGeneratedBinding(workspaceType);
  if (binding === undefined) {
    return false;
  }
  return binding.isTourPubliclyVisible(canonical);
}

/**
 * CW3-04 — manifest-bound dispatch path for registration published-tour gate parity.
 */
export function isRegistrationTourPublishedViaDispatch(
  workspaceType: string,
  canonical: CanonicalDocument,
): boolean {
  return isTourPubliclyVisible(workspaceType, canonical);
}
