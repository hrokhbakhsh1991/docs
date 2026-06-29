import type {
  WorkspaceFieldRegistry,
  WorkspaceFieldRegistryEntry,
} from "@app-tour/workspace-sdk/registry";

import type { FieldDefinition } from "../types";

export type WorkspaceFieldRegistryDefinitionsAdapterInput = {
  readonly workspaceType: string;
  readonly fieldRegistry: WorkspaceFieldRegistry;
};

function mapWorkspaceFieldToFieldDefinition(
  workspaceType: string,
  registryVersion: number,
  field: WorkspaceFieldRegistryEntry,
): FieldDefinition {
  return {
    id: field.id,
    workspaceType,
    canonicalPath: field.canonicalPath,
    kind: field.kind,
    ...(field.tags == null ? {} : { tags: field.tags }),
    ...(field.adminLabel == null ? {} : { adminLabel: field.adminLabel }),
    ...(field.adminDescription == null ? {} : { adminDescription: field.adminDescription }),
    ...(field.group == null ? {} : { group: field.group }),
    ...(field.icon == null ? {} : { icon: field.icon }),
    ...(field.enumOptions == null ? {} : { validation: { enumOptions: field.enumOptions } }),
    version: registryVersion,
  };
}

export function adaptWorkspaceFieldRegistryToFieldDefinitions(
  input: WorkspaceFieldRegistryDefinitionsAdapterInput,
): readonly FieldDefinition[] {
  return input.fieldRegistry.fields.map((field) =>
    mapWorkspaceFieldToFieldDefinition(input.workspaceType, input.fieldRegistry.version, field),
  );
}
