/**
 * CW7-11 — generic workspace pricing field-registry fragment mechanics.
 */

import type { WorkspaceFieldRegistry } from "../registry/field-registry";

/** Neutral base-price canonical path for workspace pricing capability adapters. */
export const WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH = "pricing.basePricePerPerson" as const;

export type WorkspacePricingFieldRegistryFragment = Pick<WorkspaceFieldRegistry, "version" | "fields">;

export type WorkspacePricingTourFieldConfig<
  TStepId extends string = string,
  TZodKind extends string = string,
> = {
  readonly canonicalPath: typeof WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH | string;
  readonly stepId: TStepId;
  readonly rhfPath: string;
  readonly zodPath: string;
  readonly zodKind: TZodKind;
  readonly tags: readonly string[];
  readonly ruleDefaults: { readonly required: boolean; readonly hidden: boolean };
};

export type WorkspacePricingFieldFragment<
  TField extends WorkspacePricingTourFieldConfig = WorkspacePricingTourFieldConfig,
> = {
  readonly moduleId: "workspacePricing.tourField";
  readonly fields: readonly TField[];
};

export type WorkspacePricingWizardCompositeBinding = {
  readonly rendererId: string;
  readonly anchorCanonicalPath: string;
  readonly basePriceCanonicalPath: typeof WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH;
};

export function defineWorkspacePricingFieldFragment<
  TField extends WorkspacePricingTourFieldConfig,
>(field: TField): WorkspacePricingFieldFragment<TField> {
  return Object.freeze({
    moduleId: "workspacePricing.tourField",
    fields: Object.freeze([Object.freeze(field)]),
  });
}

export function listWorkspacePricingCanonicalPaths(
  fragment: WorkspacePricingFieldRegistryFragment | WorkspacePricingFieldFragment
): readonly string[] {
  return fragment.fields.map((field) => {
    if ("canonicalPath" in field && typeof field.canonicalPath === "string") {
      return field.canonicalPath;
    }
    if ("id" in field && typeof field.id === "string") {
      return field.id;
    }
    throw new Error("workspace pricing field fragment row missing canonicalPath or id");
  });
}
