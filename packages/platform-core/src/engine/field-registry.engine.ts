import type {
  WorkspaceFieldRegistry,
  WorkspaceFieldRegistryEntry,
} from "@app-tour/workspace-sdk/registry";

import { PlatformCoreError } from "../errors/platform-core.error";
import {
  platformFail,
  platformOk,
  unwrapPlatformResult,
  type PlatformResult,
} from "../errors/platform-result";

import { MAX_ALLOWED_REGISTRY_FIELDS } from "./rule-cell-limits";

function validateRegistryStructure(
  registry: WorkspaceFieldRegistry,
): PlatformResult<void> {
  if (!Array.isArray(registry.fields)) {
    return platformFail("INVALID_RULE_SET", "fieldRegistry.fields must be an array");
  }
  if (registry.fields.length > MAX_ALLOWED_REGISTRY_FIELDS) {
    return platformFail(
      "REGISTRY_CARDINALITY_VIOLATION",
      `fieldRegistry.fields exceeds maximum allowed count (${MAX_ALLOWED_REGISTRY_FIELDS})`,
      { fieldCount: registry.fields.length },
    );
  }
  return platformOk(undefined);
}

export class FieldRegistryEngine {
  private readonly fields: readonly WorkspaceFieldRegistryEntry[];
  private readonly byId: ReadonlyMap<string, WorkspaceFieldRegistryEntry>;
  private readonly byStepId: ReadonlyMap<string, readonly WorkspaceFieldRegistryEntry[]>;

  private constructor(registry: WorkspaceFieldRegistry) {
    const seen = new Set<string>();
    const idMap = new Map<string, WorkspaceFieldRegistryEntry>();
    const stepMap = new Map<string, WorkspaceFieldRegistryEntry[]>();

    for (const field of registry.fields) {
      if (seen.has(field.id)) {
        throw new PlatformCoreError(
          "DUPLICATE_FIELD_ID",
          `Duplicate field id "${field.id}" in registry`,
        );
      }
      seen.add(field.id);
      idMap.set(field.id, Object.freeze({ ...field }));

      const stepFields = stepMap.get(field.stepId) ?? [];
      stepFields.push(field);
      stepMap.set(field.stepId, stepFields);
    }

    this.fields = Object.freeze([...registry.fields]);
    this.byId = idMap;
    this.byStepId = new Map(
      [...stepMap.entries()].map(([stepId, entries]) => [stepId, Object.freeze([...entries])]),
    );
  }

  static tryCreate(registry: WorkspaceFieldRegistry): PlatformResult<FieldRegistryEngine> {
    const structure = validateRegistryStructure(registry);
    if (!structure.ok) {
      return structure;
    }
    try {
      return platformOk(new FieldRegistryEngine(registry));
    } catch (error: unknown) {
      if (error instanceof PlatformCoreError) {
        return platformFail(error.code, error.message, error.details);
      }
      throw error;
    }
  }

  static create(registry: WorkspaceFieldRegistry): FieldRegistryEngine {
    return unwrapPlatformResult(FieldRegistryEngine.tryCreate(registry));
  }

  getById(fieldId: string): WorkspaceFieldRegistryEntry | undefined {
    return this.byId.get(fieldId);
  }

  listByStep(stepId: string): readonly WorkspaceFieldRegistryEntry[] {
    return this.byStepId.get(stepId) ?? [];
  }

  listAll(): readonly WorkspaceFieldRegistryEntry[] {
    return this.fields;
  }

  tryAssertKnownFieldIds(fieldIds: readonly string[]): PlatformResult<void> {
    for (const fieldId of fieldIds) {
      if (!this.byId.has(fieldId)) {
        return platformFail(
          "UNKNOWN_FIELD_ID",
          `Unknown field id "${fieldId}" in registry`,
        );
      }
    }
    return platformOk(undefined);
  }

  assertKnownFieldIds(fieldIds: readonly string[]): void {
    unwrapPlatformResult(this.tryAssertKnownFieldIds(fieldIds));
  }
}
