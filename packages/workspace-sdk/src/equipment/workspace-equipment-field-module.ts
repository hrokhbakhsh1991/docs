/**
 * CW7-03 — generic workspace equipment field-registry fragment mechanics.
 * Workspace adapters supply registry slices or tour-field config via their modules.
 */

import type { WorkspaceFieldRegistry } from "../registry/field-registry";

export type WorkspaceEquipmentFieldRegistryFragment = Pick<
  WorkspaceFieldRegistry,
  "version" | "fields"
>;

export type WorkspaceEquipmentFieldWireProjection = {
  readonly kind: "derived";
  readonly description: string;
};

export type WorkspaceEquipmentTourFieldConfig<
  TStepId extends string = string,
  TZodKind extends string = string,
> = {
  readonly canonicalPath: string;
  readonly stepId: TStepId;
  readonly rhfPath: string;
  readonly zodPath: string;
  readonly zodKind: TZodKind;
  readonly tags: readonly string[];
  readonly ruleDefaults: { readonly required: boolean; readonly hidden: boolean };
  readonly wire: WorkspaceEquipmentFieldWireProjection;
};

export type WorkspaceEquipmentFieldFragment<
  TField extends WorkspaceEquipmentTourFieldConfig = WorkspaceEquipmentTourFieldConfig,
> = {
  readonly moduleId: "workspaceEquipment.tourField";
  readonly fields: readonly TField[];
};

export function defineWorkspaceEquipmentFieldFragment<
  TField extends WorkspaceEquipmentTourFieldConfig,
>(field: TField): WorkspaceEquipmentFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceEquipment.tourField",
    fields: Object.freeze([Object.freeze(field)]),
  });
}

export function listWorkspaceEquipmentCanonicalPaths(
  fragment: WorkspaceEquipmentFieldRegistryFragment | WorkspaceEquipmentFieldFragment
): readonly string[] {
  return fragment.fields.map((field) => {
    if ("canonicalPath" in field && typeof field.canonicalPath === "string") {
      return field.canonicalPath;
    }
    if ("id" in field && typeof field.id === "string") {
      return field.id;
    }
    throw new Error("workspace equipment field fragment row missing canonicalPath or id");
  });
}
