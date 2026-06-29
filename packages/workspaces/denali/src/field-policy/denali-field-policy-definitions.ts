import type { FieldDefinition } from "@app-tour/platform-core";
import type { WorkspaceFieldRegistry } from "@app-tour/workspace-sdk";

import { buildDenaliWorkspaceFieldRegistry } from "../denali-plugin-adapter";

export const DENALI_FIELD_POLICY_WORKSPACE_TYPE = "denali" as const;

function mapRegistryFieldToFieldDefinition(
  workspaceType: string,
  registryVersion: number,
  field: WorkspaceFieldRegistry["fields"][number]
): FieldDefinition {
  return {
    id: field.id,
    workspaceType,
    canonicalPath: field.canonicalPath,
    kind: field.kind,
    ...(field.tags == null ? {} : { tags: field.tags }),
    ...(field.enumOptions == null ? {} : { validation: { enumOptions: field.enumOptions } }),
    version: registryVersion,
  };
}

export function buildDenaliFieldPolicyDefinitions(
  registry: WorkspaceFieldRegistry = buildDenaliWorkspaceFieldRegistry()
): readonly FieldDefinition[] {
  return Object.freeze(
    registry.fields.map((field) =>
      Object.freeze(
        mapRegistryFieldToFieldDefinition(
          DENALI_FIELD_POLICY_WORKSPACE_TYPE,
          registry.version,
          field
        )
      )
    )
  );
}
