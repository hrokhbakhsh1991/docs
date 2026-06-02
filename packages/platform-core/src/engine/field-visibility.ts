import type { WorkspaceWizardSurface } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngineScope } from "./rule-engine.scope";

export function isFieldEffectivelyHidden(
  wizard: WorkspaceWizardSurface,
  fieldEngine: FieldRegistryEngine,
  scope: RuleEngineScope,
  fieldId: string,
): boolean {
  const entry = fieldEngine.getById(fieldId);
  if (!entry) {
    throw new PlatformCoreError(
      "UNKNOWN_FIELD_ID",
      `Unknown field id "${fieldId}" in registry`,
    );
  }

  if (
    entry.groupSlug != null &&
    wizard.inactiveFieldGroups.includes(entry.groupSlug)
  ) {
    return true;
  }

  return scope.resolveEffectiveField(fieldId).hidden;
}
