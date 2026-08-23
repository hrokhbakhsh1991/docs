import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  assertDenaliFrozenWizardTemplateFieldsPresent,
  DENALI_SMOKE_TENANT_ID,
  normalizeDenaliWizardTemplatePayloadSteps,
} from "@app-tour/workspace-denali";
import { URBAN_SMOKE_TENANT_ID } from "@app-tour/workspace-urban";

import {
  assertWorkspaceWizardTemplateEnforcedFieldsForTenant,
  normalizeWorkspaceWizardTemplatePayloadForTenant,
  SettingsWizardFrozenFieldMissingError,
} from "../src/settings/wizard-template-catalog";

describe("wizard-template-frozen-fields.spec.ts", () => {
  it("API-WIZ-FRZ-01 normalizeWorkspaceWizardTemplatePayloadForTenant injects enforced fields for denali", () => {
    const normalized = normalizeWorkspaceWizardTemplatePayloadForTenant("denali", {
      published: true,
      steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
    });
    assert.ok(
      normalized.steps?.some((step) =>
        step.fields.some((field) => field.canonicalPath === "category")
      )
    );
  });

  it("API-WIZ-FRZ-02 assertWorkspaceWizardTemplateEnforcedFieldsForTenant rejects missing enforced field", async () => {
    await assert.rejects(
      () =>
        assertWorkspaceWizardTemplateEnforcedFieldsForTenant(DENALI_SMOKE_TENANT_ID, {
          published: true,
          steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
        }),
      SettingsWizardFrozenFieldMissingError
    );
  });

  it("API-WIZ-FRZ-03 starter workspace skips frozen assert", async () => {
    await assert.doesNotReject(() =>
      assertWorkspaceWizardTemplateEnforcedFieldsForTenant(URBAN_SMOKE_TENANT_ID, {
        published: true,
        steps: [{ stepId: "basics", enabled: true, fields: [{ canonicalPath: "basics.title" }] }],
      })
    );
  });

  it("API-WIZ-FRZ-04 workspace-denali assert helper throws on stripped payload", () => {
    assert.throws(
      () =>
        assertDenaliFrozenWizardTemplateFieldsPresent({
          published: true,
          steps: [{ stepId: "denali_basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
        }),
      (error: unknown) =>
        error instanceof Error && error.message.includes("SETTINGS_WIZARD_FROZEN_FIELD_MISSING")
    );
  });

  it("API-WIZ-FRZ-05 normalize payload steps is no-op when unpublished", () => {
    const payload = { published: false, steps: [] };
    assert.deepEqual(normalizeDenaliWizardTemplatePayloadSteps(payload), payload);
  });

  it("API-WIZ-FRZ-06 settings service uses workspace-named template enforcement", () => {
    const source = readFileSync(
      new URL("../src/settings/settings-config.service.ts", import.meta.url),
      "utf8"
    );
    assert.equal(source.includes("assertDenaliWizardTemplateFrozenFieldsForTenant"), false);
    assert.equal(source.includes("normalizeDenaliWizardTemplatePayloadForTenant"), false);
  });
});
