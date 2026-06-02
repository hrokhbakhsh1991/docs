import type { DenaliCanonicalTourModel } from "./denaliCanonicalTourModel";

/**
 * Keep in sync with `DENALI_RULE_MODEL_VERSION` in
 * `apps/web/.../denali/rules/denaliRuleModel.ts` and {@link deriveDenaliTemplateSchema}.
 */
export const DENALI_TEMPLATE_SCHEMA_VERSION = "1.1.0" as const;

export type DenaliTemplateSchemaField = {
  readonly path: string;
  readonly required: boolean;
  readonly hidden: boolean;
  readonly step: string;
};

export type DenaliTemplateSchemaModel = {
  readonly category: DenaliCanonicalTourModel["category"];
  readonly duration: "single_day" | "multi_day";
  readonly fields: readonly DenaliTemplateSchemaField[];
};

export type DenaliTemplateSchema = {
  readonly version: typeof DENALI_TEMPLATE_SCHEMA_VERSION;
  readonly steps: readonly string[];
  readonly models: readonly DenaliTemplateSchemaModel[];
};

/** Partial canonical payload stored on workspace tour templates / presets. */
export type DenaliCanonicalTemplateData = Partial<{
  [K in keyof DenaliCanonicalTourModel]: DenaliCanonicalTourModel[K] extends object
    ? Partial<DenaliCanonicalTourModel[K]>
    : DenaliCanonicalTourModel[K];
}>;
