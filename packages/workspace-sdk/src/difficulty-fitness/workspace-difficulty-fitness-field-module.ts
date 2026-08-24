/**
 * CW7-09 — generic workspace difficulty/fitness field-registry fragment mechanics.
 * Workspace adapters supply registry slices or tour-field config via their modules.
 */

import type { WorkspaceFieldRegistry } from "../registry/field-registry";

export type WorkspaceDifficultyFitnessFieldRegistryFragment = Pick<
  WorkspaceFieldRegistry,
  "version" | "fields"
>;

export type WorkspaceDifficultyFitnessFieldWireProjection = {
  readonly kind: "derived";
  readonly description: string;
};

export type WorkspaceDifficultyFitnessTourFieldConfig<
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
  readonly wire: WorkspaceDifficultyFitnessFieldWireProjection;
};

export type WorkspaceDifficultyFitnessFieldFragment<
  TField extends WorkspaceDifficultyFitnessTourFieldConfig = WorkspaceDifficultyFitnessTourFieldConfig,
> = {
  readonly moduleId: "workspaceDifficultyFitness.tourField";
  readonly fields: readonly TField[];
};

export function defineWorkspaceDifficultyFitnessFieldFragment<
  TField extends WorkspaceDifficultyFitnessTourFieldConfig,
>(field: TField): WorkspaceDifficultyFitnessFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceDifficultyFitness.tourField",
    fields: Object.freeze([Object.freeze(field)]),
  });
}

/** CW7-09 — multi-row tour-field fragment (difficulty + fitness). */
export function defineWorkspaceDifficultyFitnessFieldFragments<
  TField extends WorkspaceDifficultyFitnessTourFieldConfig,
>(fields: readonly TField[]): WorkspaceDifficultyFitnessFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspaceDifficultyFitness.tourField",
    fields: Object.freeze(fields.map((field) => Object.freeze(field))),
  });
}

export function listWorkspaceDifficultyFitnessCanonicalPaths(
  fragment:
    | WorkspaceDifficultyFitnessFieldRegistryFragment
    | WorkspaceDifficultyFitnessFieldFragment
): readonly string[] {
  return fragment.fields.map((field) => {
    if ("canonicalPath" in field && typeof field.canonicalPath === "string") {
      return field.canonicalPath;
    }
    if ("id" in field && typeof field.id === "string") {
      return field.id;
    }
    throw new Error("workspace difficulty/fitness field fragment row missing canonicalPath or id");
  });
}
