/**
 * Phase 9.6 — wizard template UI (SMK-P9-05)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWizardTemplatePutBody,
  isWizardTemplatePersisted,
  parseWizardTemplateResponse,
} from "../src/features/settings/wizard-template-logic";
import {
  WIZARD_TEMPLATE_CONFIG_VERSION,
  WIZARD_TEMPLATE_TEST_IDS,
} from "../src/features/settings/wizard-template-types";

describe("settings-template.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-01 wizard template seed persists", () => {
    assert.equal(WIZARD_TEMPLATE_TEST_IDS.page, "operator-wizard-template-page");
    assert.equal(WIZARD_TEMPLATE_TEST_IDS.seedInput, "operator-wizard-template-seed");
    assert.equal(WIZARD_TEMPLATE_TEST_IDS.saveButton, "operator-wizard-template-save");
    assert.equal(
      WIZARD_TEMPLATE_TEST_IDS.loadFullTemplateButton,
      "operator-wizard-template-load-full"
    );

    const body = buildWizardTemplatePutBody({
      seedLabel: "SMK-P9-SEED",
      sections: [{ id: "basics", label: "Basics", enabled: true }],
      published: true,
      steps: [{ stepId: "basics", label: "Basics", enabled: true, fields: [{ canonicalPath: "basics.title" }] }],
    });
    assert.equal(body.configVersion, WIZARD_TEMPLATE_CONFIG_VERSION);
    const payload = body.payload as Record<string, unknown>;
    assert.equal(payload.seedLabel, "SMK-P9-SEED");

    const parsed = parseWizardTemplateResponse({
      configKey: "wizard_template",
      configVersion: 1,
      source: "tenant",
      updatedAt: new Date().toISOString(),
      payload: {
        seedLabel: "SMK-P9-SEED",
        sections: [{ id: "basics", label: "Basics", enabled: true }],
        published: true,
      },
    });
    assert.equal(parsed.seedLabel, "SMK-P9-SEED");
    assert.equal(parsed.published, true);
    assert.equal(
      isWizardTemplatePersisted({ seedLabel: "", sections: [] }, parsed),
      true
    );
  });
});
