import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_TEMPLATE_SCHEMA_VERSION } from "@repo/types/denali";

import { denaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";

import {
  DENALI_TEMPLATE_SCHEMA,
  deriveDenaliTemplateSchema,
  listDenaliTemplateCanonicalFieldPaths,
} from "./deriveDenaliTemplateSchema";

test("deriveDenaliTemplateSchema mirrors denaliRuleSet version and models", () => {
  const schema = deriveDenaliTemplateSchema();
  assert.equal(schema.version, DENALI_TEMPLATE_SCHEMA_VERSION);
  assert.ok(schema.models.length > 0);
  assert.ok(schema.steps.length > 0);
  assert.deepEqual(schema.steps, denaliWizardSteps);
  assert.equal(schema.version, DENALI_TEMPLATE_SCHEMA.version);
});

test("listDenaliTemplateCanonicalFieldPaths includes title", () => {
  const paths = listDenaliTemplateCanonicalFieldPaths();
  assert.ok(paths.includes("title"));
});
