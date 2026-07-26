import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { URBAN_FIELD_REGISTRY } from "../src/internal";
import {
  buildUrbanMinimalWizardTemplatePayload,
  buildUrbanMinimalWizardTemplateSteps,
} from "../src/settings/urbanMinimalWizardTemplate";

describe("urban-minimal-wizard-template.spec.ts (P15-P-D0)", () => {
  it("URBAN-TPL-01 covers every registry path except review-only fields", () => {
    const paths = new Set(
      buildUrbanMinimalWizardTemplateSteps().flatMap((step) =>
        step.fields.map((field) => field.canonicalPath)
      )
    );
    for (const entry of URBAN_FIELD_REGISTRY.fields) {
      assert.ok(paths.has(entry.canonicalPath), `missing ${entry.canonicalPath}`);
    }
  });

  it("URBAN-TPL-02 keeps tour.title first on main step", () => {
    const main = buildUrbanMinimalWizardTemplateSteps().find((step) => step.stepId === "urban_tour");
    assert.equal(main?.fields[0]?.canonicalPath, "tour.title");
    assert.equal(main?.fields[0]?.required, true);
  });

  it("URBAN-TPL-03 builds publishable payload", () => {
    const payload = buildUrbanMinimalWizardTemplatePayload();
    assert.equal(payload.published, true);
    assert.equal(payload.steps.length, 2);
    const review = payload.steps.find((step) => step.stepId === "review");
    assert.equal(review?.fields[0]?.canonicalPath, "tour.publishStatus");
  });
});
