import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliWizardMessages,
  resolveDenaliFieldKindLabelFromMessages,
  resolveDenaliFieldLabelFromMessages,
  resolveDenaliStepLabelFromMessages,
  type DenaliWizardMessages,
} from "../src/ui/adapters/field-labels-from-messages.ts";

const sample: DenaliWizardMessages = {
  steps: { denali_basic: "Basic info" },
  fields: { title: "Tour name", destinationId: "Destination" },
  fieldKinds: { composite: "Multi-field widget" },
  tourKinds: {},
  transportModes: {},
};

describe("field-labels-from-messages", () => {
  it("resolves nested fields and composite id remap", () => {
    assert.equal(resolveDenaliFieldLabelFromMessages(sample, "title"), "Tour name");
    assert.equal(resolveDenaliFieldLabelFromMessages(sample, "denali.destination"), "Destination");
  });

  it("falls back for unknown steps and kinds", () => {
    assert.equal(resolveDenaliStepLabelFromMessages(sample, "denali_basic"), "Basic info");
    assert.equal(resolveDenaliStepLabelFromMessages(sample, "denali_extra_step"), "Extra Step");
    assert.equal(resolveDenaliFieldKindLabelFromMessages(sample, "composite"), "Multi-field widget");
    assert.equal(resolveDenaliFieldKindLabelFromMessages(sample, "unknown"), "unknown");
  });

  it("guards DenaliWizardMessages shape", () => {
    assert.equal(isDenaliWizardMessages(sample), true);
    assert.equal(isDenaliWizardMessages({ steps: {}, fields: null }), false);
  });
});
