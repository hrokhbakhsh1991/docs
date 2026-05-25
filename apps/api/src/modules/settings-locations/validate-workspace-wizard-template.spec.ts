import assert from "node:assert/strict";
import test from "node:test";

import { collectWorkspaceWizardTemplateValidationErrors } from "./validate-workspace-wizard-template";

test("collectWorkspaceWizardTemplateValidationErrors flags invalid overlay enums", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    fieldRulesOverlay: { title: { visibility: "maybe", required: "mandatory" } },
  });
  assert.ok(errors.some((e) => e.path === "fieldRulesOverlay.title.visibility"));
  assert.ok(errors.some((e) => e.path === "fieldRulesOverlay.title.required"));
});

test("collectWorkspaceWizardTemplateValidationErrors flags unknown canonical keys", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    canonicalData: { totallyUnknownRoot: true },
  });
  assert.ok(errors.some((e) => e.path.startsWith("canonicalData")));
});
