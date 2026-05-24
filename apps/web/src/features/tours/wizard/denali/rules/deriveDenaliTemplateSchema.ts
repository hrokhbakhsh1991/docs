import {
  DENALI_TEMPLATE_SCHEMA_VERSION,
  type DenaliTemplateSchema,
} from "@repo/types/denali";

import { denaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";

import type {
  DenaliRuleFieldDefinition,
  DenaliRuleModel,
  DenaliRuleSet,
} from "./denaliRuleModel";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  denaliRuleSet,
} from "./denaliRuleModel";

export type { DenaliTemplateSchema, DenaliTemplateSchemaField, DenaliTemplateSchemaModel } from "@repo/types/denali";

function mapModelToSchema(
  model: DenaliRuleModel,
): DenaliTemplateSchema["models"][number] {
  return {
    category: model.category,
    duration: model.duration,
    fields: model.fields.map((field) => ({
      path: field.path,
      required: field.required,
      hidden: field.hidden,
      step: field.step,
    })),
  };
}

/** Derive {@link DenaliTemplateSchema} from the static Denali rule engine model. */
export function deriveDenaliTemplateSchema(
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliTemplateSchema {
  const models: DenaliTemplateSchemaModel[] = [];
  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = ruleSet[category][duration];
      if (model != null) {
        models.push(mapModelToSchema(model));
      }
    }
  }
  return {
    version: DENALI_TEMPLATE_SCHEMA_VERSION,
    steps: [...denaliWizardSteps],
    models,
  };
}

/** All canonical field paths declared across every rule model (unique, sorted). */
export function listDenaliTemplateCanonicalFieldPaths(
  schema: DenaliTemplateSchema = deriveDenaliTemplateSchema(),
): readonly string[] {
  const paths = new Set<string>();
  for (const model of schema.models) {
    for (const field of model.fields) {
      paths.add(field.path);
    }
  }
  return [...paths].sort();
}

export const DENALI_TEMPLATE_SCHEMA = deriveDenaliTemplateSchema();
