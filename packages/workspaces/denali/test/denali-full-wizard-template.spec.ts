import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliFullWizardTemplatePayload,
  buildDenaliFullWizardTemplateSteps,
  buildDenaliTenantWizardTemplatePayload,
} from "../src/settings/denaliFullWizardTemplate";
import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";

describe("denali-full-wizard-template.spec.ts", () => {
  it("DN-FULL-TPL-01 keeps category first for rule matrix", () => {
    const basic = buildDenaliFullWizardTemplateSteps().find((step) => step.stepId === "denali_basic");
    assert.equal(basic?.fields[0]?.canonicalPath, "category");
    assert.equal(basic?.fields[0]?.required, true);
  });

  it("DN-FULL-TPL-02 includes composite anchor fields across all rails", () => {
    const paths = new Set(
      buildDenaliFullWizardTemplateSteps().flatMap((step) =>
        step.fields.map((field) => field.canonicalPath)
      )
    );
    for (const path of [
      "transport.mode",
      "program.itinerary",
      "photos",
      "participants.gearItems",
      "leaderUserIds",
    ]) {
      assert.ok(paths.has(path), `missing ${path}`);
    }
  });

  it("DN-FULL-TPL-03 builds publishable payload", () => {
    const payload = buildDenaliFullWizardTemplatePayload();
    assert.equal(payload.published, true);
    assert.ok(payload.steps.length >= 7);
  });

  it("DN-FULL-TPL-04 includes review step with publishStatus", () => {
    const review = buildDenaliFullWizardTemplateSteps().find((step) => step.stepId === "review");
    assert.ok(review?.enabled);
    assert.equal(review?.fields[0]?.canonicalPath, "publishStatus");
  });

  it("DN-FULL-TPL-05 logistics step orders transport, gathering, then route locations", () => {
    const logistics = buildDenaliFullWizardTemplateSteps().find(
      (step) => step.stepId === "denali_logistics"
    );
    assert.deepEqual(
      logistics?.fields.map((field) => field.canonicalPath),
      [
        "transport.mode",
        "gatheringPoints",
        "startPoint",
        "participants.gearItems",
        "tripDetails.logistics.includedServices",
        "tripDetails.overview.customServiceLabels",
      ]
    );
  });

  it("DN-FULL-TPL-06 full template fields are wizard-template catalog paths", () => {
    const registry = buildDenaliWorkspaceFieldRegistry();
    const catalogPaths = new Set(
      registry.fields
        .filter((field) => !field.tags?.includes("wizard_overlay_exclude"))
        .map((field) => field.canonicalPath)
    );
    for (const step of buildDenaliTenantWizardTemplatePayload().steps) {
      for (const field of step.fields) {
        if (field.canonicalPath === "publishStatus") {
          continue;
        }
        assert.ok(
          catalogPaths.has(field.canonicalPath),
          `template field not in catalog: ${field.canonicalPath}`
        );
      }
    }
  });

  it("DN-FULL-TPL-07 tenant publish payload omits review overlay fields", () => {
    const payload = buildDenaliTenantWizardTemplatePayload();
    assert.ok(!payload.steps.some((step) => step.stepId === "review"));
    const paths = payload.steps.flatMap((step) => step.fields.map((field) => field.canonicalPath));
    assert.ok(!paths.includes("publishStatus"));
  });

  it("DN-FULL-TPL-08 pricing step anchors composite for basePricePerPerson", () => {
    const pricing = buildDenaliFullWizardTemplateSteps().find(
      (step) => step.stepId === "denali_pricing"
    );
    const paths = new Set(pricing?.fields.map((field) => field.canonicalPath) ?? []);
    assert.ok(paths.has("pricing.requiresPayment"));
    assert.ok(!paths.has("pricing.basePricePerPerson"));
  });
});
