import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliTenantWizardTemplatePayload } from "@app-tour/workspace-denali";

import { buildExposureSelectableFieldCatalog } from "./exposure-field-catalog";
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

  it("never widens the redaction-safe deliverable catalog for Denali", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });
    const deliverableCatalog = await buildExposureSelectableFieldCatalog("denali");

    const deliverableIds = new Set(deliverableCatalog.map((field) => field.id));
    assert.ok(wizardCatalog.every((field) => deliverableIds.has(field.id)));
    assert.ok(!wizardCatalog.some((field) => field.canonicalPath === "program.difficultyLevel"));
    assert.ok(wizardCatalog.some((field) => field.canonicalPath === "transport.mode"));
  });

  it("groups wizard-template fields by step label", async () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });
    const basicStep = payload.steps?.find((step) => step.stepId === "denali_basic");
    assert.ok(basicStep != null);

    const title = wizardCatalog.find(
      (field) => field.canonicalPath === "title"
    );
    assert.equal(title?.group, basicStep.label);
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
      (await buildExposureSelectableFieldCatalog("denali")).map((field) => field.id)
    );
    const wizardCatalog = await buildWizardTemplateExposureCatalog({
      workspaceType: "denali",
      wizardTemplatePayload: payload,
    });

    assert.ok(wizardCatalog.every((field) => registryIds.has(field.id)));
  });
});
