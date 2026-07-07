import type {
  WorkspaceFieldPolicyManifest,
  WorkspaceFieldPolicyRule,
  WorkspaceFieldRegistry,
  WorkspaceSimpleCondition,
} from "@app-tour/workspace-sdk/registry";
import { assertNoLegacyDeliveryCandidateFieldIds } from "@app-tour/workspace-sdk/registry";

import { adaptWorkspaceFieldRegistryToFieldDefinitions } from "./workspace-field-registry-to-definitions";
import type { FieldDefinition, FieldPolicyRule, SimpleCondition } from "../types";

export type WorkspaceFieldPolicyManifestAdapterInput = {
  readonly workspaceType: string;
  readonly manifest: WorkspaceFieldPolicyManifest;
  /** Fills definitions for manifest rule/candidate ids that exist only in the registry. */
  readonly fieldRegistry?: WorkspaceFieldRegistry;
  /** Runtime delivery candidates — registry definitions merged even without manifest rules. */
  readonly candidateFieldIds?: readonly string[];
};

function mapCondition(condition: WorkspaceSimpleCondition | undefined): SimpleCondition | undefined {
  if (condition == null) {
    return undefined;
  }
  if (condition.kind === "always") {
    return { kind: "always" };
  }
  if (condition.kind === "equals") {
    return {
      kind: "equals",
      path: condition.path,
      value: condition.value,
    };
  }
  return {
    kind: "exists",
    path: condition.path,
  };
}

function mapRule(workspaceType: string, rule: WorkspaceFieldPolicyRule): FieldPolicyRule {
  const mapped: FieldPolicyRule = {
    id: rule.id,
    workspaceType,
    fieldId: rule.fieldId,
    surface: rule.surface,
    state: rule.state,
    priority: rule.priority,
    enabled: rule.enabled,
  };
  const condition = mapCondition(rule.condition);
  return condition == null ? mapped : { ...mapped, condition };
}

function collectReferencedFieldIds(manifest: WorkspaceFieldPolicyManifest): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const definition of manifest.definitions) {
    ids.add(definition.id);
  }
  for (const rule of manifest.rules) {
    ids.add(rule.fieldId);
  }
  return ids;
}

function mapManifestDefinition(
  workspaceType: string,
  manifest: WorkspaceFieldPolicyManifest,
  definition: WorkspaceFieldPolicyManifest["definitions"][number],
): FieldDefinition {
  return {
    id: definition.id,
    workspaceType,
    canonicalPath: definition.canonicalPath,
    kind: definition.kind,
    ...(definition.labelKey == null ? {} : { labelKey: definition.labelKey }),
    ...(definition.descriptionKey == null ? {} : { descriptionKey: definition.descriptionKey }),
    ...(definition.tags == null ? {} : { tags: definition.tags }),
    ...(definition.validation == null ? {} : { validation: definition.validation }),
    version: manifest.manifestVersion,
  };
}

export function adaptWorkspaceFieldPolicyManifest(
  input: WorkspaceFieldPolicyManifestAdapterInput,
): {
  readonly definitions: readonly FieldDefinition[];
  readonly rules: readonly FieldPolicyRule[];
} {
  assertNoLegacyDeliveryCandidateFieldIds(input.manifest, "adaptWorkspaceFieldPolicyManifest");

  const referencedFieldIds = new Set(collectReferencedFieldIds(input.manifest));
  if (input.candidateFieldIds != null) {
    for (const fieldId of input.candidateFieldIds) {
      referencedFieldIds.add(fieldId);
    }
  }
  const definitionById = new Map<string, FieldDefinition>();

  for (const definition of input.manifest.definitions) {
    definitionById.set(
      definition.id,
      mapManifestDefinition(input.workspaceType, input.manifest, definition),
    );
  }

  if (input.fieldRegistry != null) {
    const registryDefinitions = adaptWorkspaceFieldRegistryToFieldDefinitions({
      workspaceType: input.workspaceType,
      fieldRegistry: input.fieldRegistry,
    });
    for (const definition of registryDefinitions) {
      if (referencedFieldIds.has(definition.id) && !definitionById.has(definition.id)) {
        definitionById.set(definition.id, definition);
      }
    }
  }

  const definitions = [...definitionById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const rules = input.manifest.rules.map((rule) => mapRule(input.workspaceType, rule));

  return {
    definitions,
    rules,
  };
}
