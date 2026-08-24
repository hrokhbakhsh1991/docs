/**
 * CW7-07 — generic workspace transport field-registry fragment mechanics.
 */

import type { WorkspaceFieldRegistry } from "../registry/field-registry";

export type WorkspaceTransportFieldRegistryFragment = Pick<WorkspaceFieldRegistry, "version" | "fields">;

export type WorkspaceTransportTourFieldConfig<
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
};

export type WorkspaceTransportFieldFragment<
  TField extends WorkspaceTransportTourFieldConfig = WorkspaceTransportTourFieldConfig,
> = {
  readonly moduleId: "workspaceTransport.tourField";
  readonly fields: readonly TField[];
};

export type WorkspaceTransportWizardCompositeBinding = {
  readonly rendererId: string;
  readonly canonicalPath: string;
  readonly zodKind: string;
};

export function defineWorkspaceTransportFieldFragment<
  TField extends WorkspaceTransportTourFieldConfig,
>(field: TField): WorkspaceTransportFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceTransport.tourField",
    fields: Object.freeze([Object.freeze(field)]),
  });
}

export function defineWorkspaceTransportFieldFragments<
  TField extends WorkspaceTransportTourFieldConfig,
>(fields: readonly TField[]): WorkspaceTransportFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceTransport.tourField",
    fields: Object.freeze(fields.map((field) => Object.freeze(field))),
  });
}

export function listWorkspaceTransportCanonicalPaths(
  fragment: WorkspaceTransportFieldRegistryFragment | WorkspaceTransportFieldFragment
): readonly string[] {
  return fragment.fields.map((field) => {
    if ("canonicalPath" in field && typeof field.canonicalPath === "string") {
      return field.canonicalPath;
    }
    if ("id" in field && typeof field.id === "string") {
      return field.id;
    }
    throw new Error("workspace transport field fragment row missing canonicalPath or id");
  });
}
