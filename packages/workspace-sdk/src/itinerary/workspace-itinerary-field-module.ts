/**
 * CW7-10 — generic workspace itinerary field-registry fragment mechanics.
 */

import type { WorkspaceFieldRegistry } from "../registry/field-registry";

export type WorkspaceItineraryFieldRegistryFragment = Pick<WorkspaceFieldRegistry, "version" | "fields">;

export type WorkspaceItineraryTourFieldConfig<
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

export type WorkspaceItineraryFieldFragment<
  TField extends WorkspaceItineraryTourFieldConfig = WorkspaceItineraryTourFieldConfig,
> = {
  readonly moduleId: "workspaceItinerary.tourField";
  readonly fields: readonly TField[];
};

export type WorkspaceItineraryWizardCompositeBinding = {
  readonly compositeId: string;
  readonly anchorCanonicalPath: string;
};

export function defineWorkspaceItineraryFieldFragment<
  TField extends WorkspaceItineraryTourFieldConfig,
>(field: TField): WorkspaceItineraryFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceItinerary.tourField",
    fields: Object.freeze([Object.freeze(field)]),
  });
}

export function listWorkspaceItineraryCanonicalPaths(
  fragment: WorkspaceItineraryFieldRegistryFragment | WorkspaceItineraryFieldFragment
): readonly string[] {
  return fragment.fields.map((field) => {
    if ("canonicalPath" in field && typeof field.canonicalPath === "string") {
      return field.canonicalPath;
    }
    if ("id" in field && typeof field.id === "string") {
      return field.id;
    }
    throw new Error("workspace itinerary field fragment row missing canonicalPath or id");
  });
}
