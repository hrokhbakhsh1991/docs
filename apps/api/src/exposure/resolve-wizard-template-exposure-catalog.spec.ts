import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliTenantWizardTemplatePayload } from "@app-tour/workspace-denali";

import {
  buildExposureFieldCatalog,
  buildExposureSelectableFieldCatalog,
} from "./exposure-field-catalog";
import {
  buildWizardTemplateExposureCatalog,
  isWizardTemplatePublishedForExposure,
  resolveWizardTemplateAllowedCanonicalPaths,
} from "./resolve-wizard-template-exposure-catalog";

describe("resolve-wizard-template-exposure-catalog", () => {
  it("extracts allowed canonical paths from a published tenant template", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    assert.equal(isWizardTemplatePublishedForExposure(payload), true);

    const paths = resolveWizardTemplateAllowedCanonicalPaths(payload);
    assert.ok(paths.includes("title"));
    assert.ok(paths.includes("program.difficultyLevel"));
    assert.ok(paths.includes("transport.mode"));
    assert.ok(!paths.includes("publishStatus"));
  });

  it("returns more selectable fields than deliverable-only seed for Denali", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });
    const deliverableCatalog = await buildExposureSelectableFieldCatalog("denali");

    assert.ok(wizardCatalog.length > deliverableCatalog.length);
    assert.ok(wizardCatalog.some((field) => field.canonicalPath === "program.difficultyLevel"));
    assert.ok(wizardCatalog.some((field) => field.canonicalPath === "transport.mode"));
  });

  it("groups wizard-template fields by step label", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });
    const programStep = payload.steps?.find((step) => step.stepId === "denali_program");
    assert.ok(programStep != null);

    const difficulty = wizardCatalog.find(
      (field) => field.canonicalPath === "program.difficultyLevel"
    );
    assert.equal(difficulty?.group, programStep.label);
  });

  it("returns empty catalog for unpublished templates", async () => {
    const payload = {
      ...buildDenaliTenantWizardTemplatePayload(),
      published: false,
    };
    assert.deepEqual(
      await buildWizardTemplateExposureCatalog({
        workspaceType: "denali",
        wizardTemplatePayload: payload,
      }),
      []
    );
  });

  it("only includes registry-backed fields", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    const registryIds = new Set(
      (await buildExposureFieldCatalog("denali")).map((field) => field.id)
    );
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });

    assert.ok(wizardCatalog.every((field) => registryIds.has(field.id)));
  });
});
