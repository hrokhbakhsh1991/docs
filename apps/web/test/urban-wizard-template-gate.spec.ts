/**
 * P15-W-D1 — urban wizard template gate + fixture contract
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUrbanMinimalWizardTemplatePayload } from "@app-tour/workspace-urban";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";

import {
  isWizardTemplatePublished,
  resolveWizardTemplateGateState,
} from "../src/tours/wizard-template-gate-logic";
import { resolveWizardTemplateSeedCanonicalPath } from "../src/tours/wizard-template-prefill-logic";
import {
  URBAN_WIZARD_TITLE_CANONICAL_PATH,
  URBAN_WIZARD_TEMPLATE_SETTINGS_PATH,
} from "./fixtures/urban-wizard-template-fixture";

describe("urban-wizard-template-gate.spec.ts — P15-W-D1", () => {
  it("WEB-P15-D1-01 fixture paths align with urban registry seed canonical path", () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(URBAN_WIZARD_TEMPLATE_SETTINGS_PATH, "/settings/tour-wizard-template");
    assert.equal(
      resolveWizardTemplateSeedCanonicalPath("urban", plugin),
      URBAN_WIZARD_TITLE_CANONICAL_PATH
    );
    assert.equal(URBAN_WIZARD_TITLE_CANONICAL_PATH, "tour.title");
  });

  it("WEB-P15-D1-02 published minimal template opens urban create gate", () => {
    const plugin = getUrbanWorkspacePlugin();
    const payload = buildUrbanMinimalWizardTemplatePayload("Urban smoke tour");

    assert.equal(isWizardTemplatePublished(payload), true);

    const gate = resolveWizardTemplateGateState(
      {
        configKey: "wizard_template",
        configVersion: 1,
        source: "tenant",
        updatedAt: null,
        payload,
      },
      "urban",
      plugin
    );

    assert.equal(gate.published, true);
    assert.ok(gate.allowedCanonicalPaths.includes("tour.title"));
    assert.ok(gate.allowedCanonicalPaths.includes("tour.publishStatus"));
    assert.equal(gate.templateSteps[0]?.stepId, "urban_tour");
    assert.equal(gate.templateSteps[0]?.fields[0]?.canonicalPath, "tour.title");
  });
});
