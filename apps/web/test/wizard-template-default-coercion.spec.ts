import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";

import { coerceWizardTemplateDefaultValue } from "../src/tours/wizard-template-default-coercion";

describe("wizard-template-default-coercion.spec.ts", () => {
  const denali = getDenaliWorkspacePlugin();

  it("coerces boolean defaults", () => {
    assert.equal(
      coerceWizardTemplateDefaultValue(
        "pricing.requiresPayment",
        "true",
        denali
      ),
      "true"
    );
  });

  it("coerces JSON theme id arrays", () => {
    assert.deepEqual(
      coerceWizardTemplateDefaultValue(
        "program.themeIds",
        '["theme-a","theme-b"]',
        denali
      ),
      ["theme-a", "theme-b"]
    );
  });

  it("coerces comma-separated theme ids", () => {
    assert.deepEqual(
      coerceWizardTemplateDefaultValue(
        "program.themeIds",
        "theme-a, theme-b",
        denali
      ),
      ["theme-a", "theme-b"]
    );
  });

  it("coerces transport mode enum string", () => {
    assert.equal(
      coerceWizardTemplateDefaultValue("transport.mode", "bus", denali),
      "bus"
    );
  });
});
