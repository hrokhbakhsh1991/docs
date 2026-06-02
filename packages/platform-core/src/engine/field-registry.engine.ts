import type {
  WorkspaceFieldRegistry,
  WorkspaceFieldRegistryEntry,
} from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";

export class FieldRegistryEngine {
  private readonly fields: readonly WorkspaceFieldRegistryEntry[];
  private readonly byId: ReadonlyMap<string, WorkspaceFieldRegistryEntry>;
  private readonly byCanonicalPath: ReadonlyMap<string, WorkspaceFieldRegistryEntry>;
  private readonly byStepId: ReadonlyMap<string, readonly WorkspaceFieldRegistryEntry[]>;

  constructor(registry: WorkspaceFieldRegistry) {
    if (!Array.isArray(registry.fields)) {
      throw new PlatformCoreError(
        "INVALID_RULE_SET",
        "fieldRegistry.fields must be an array",
      );
    }

    const seen = new Set<string>();
    const idMap = new Map<string, WorkspaceFieldRegistryEntry>();
    const pathMap = new Map<string, WorkspaceFieldRegistryEntry>();
    const stepMap = new Map<string, WorkspaceFieldRegistryEntry[]>();

    for (const field of registry.fields) {
      if (seen.has(field.id)) {
        throw new PlatformCoreError(
          "DUPLICATE_FIELD_ID",
          `Duplicate field id "${field.id}" in registry`,
        );
      }
      seen.add(field.id);
      idMap.set(field.id, field);
      pathMap.set(field.canonicalPath, field);

      const stepFields = stepMap.get(field.stepId) ?? [];
      stepFields.push(field);
      stepMap.set(field.stepId, stepFields);
    }

    this.fields = Object.freeze([...registry.fields]);
    this.byId = idMap;
    this.byCanonicalPath = pathMap;
    this.byStepId = new Map(
      [...stepMap.entries()].map(([stepId, entries]) => [stepId, Object.freeze([...entries])]),
    );
  }

  getById(fieldId: string): WorkspaceFieldRegistryEntry | undefined {
    return this.byId.get(fieldId);
  }

  getByCanonicalPath(path: string): WorkspaceFieldRegistryEntry | undefined {
    return this.byCanonicalPath.get(path);
  }

  listByStep(stepId: string): readonly WorkspaceFieldRegistryEntry[] {
    return this.byStepId.get(stepId) ?? [];
  }

  listAll(): readonly WorkspaceFieldRegistryEntry[] {
    return this.fields;
  }

  assertKnownFieldIds(fieldIds: readonly string[]): void {
    for (const fieldId of fieldIds) {
      if (!this.byId.has(fieldId)) {
        throw new PlatformCoreError(
          "UNKNOWN_FIELD_ID",
          `Unknown field id "${fieldId}" in registry`,
        );
      }
    }
  }
}
