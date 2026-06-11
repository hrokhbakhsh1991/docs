import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliFullWizardTemplatePayload,
  buildDenaliFullWizardTemplateSteps,
} from "../src/settings/denaliFullWizardTemplate";

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
});
