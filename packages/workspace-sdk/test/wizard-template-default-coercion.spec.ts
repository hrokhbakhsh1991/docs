import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "../src/reference/starter-workspace.plugin";
import {
  coerceWizardTemplateDefaultValue,
  isWizardTemplateDefaultValueCoercible,
} from "../src/wizard/wizard-template-default-coercion";

describe("wizard-template-default-coercion", () => {
  it("SDK-WIZ-01 rejects invalid boolean defaults", () => {
    const plugin = {
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "pricing.requiresPayment",
            canonicalPath: "pricing.requiresPayment",
            stepId: "pricing",
            kind: "boolean" as const,
            required: false,
          },
        ],
      },
    };
    assert.equal(coerceWizardTemplateDefaultValue("pricing.requiresPayment", "maybe", plugin), null);
    assert.equal(isWizardTemplateDefaultValueCoercible("pricing.requiresPayment", "maybe", plugin), false);
  });

  it("SDK-WIZ-02 rejects enum values outside enumOptions", () => {
    const starter = getStarterWorkspacePlugin();
    assert.equal(coerceWizardTemplateDefaultValue("details.status", "not-a-status", starter), null);
    assert.equal(coerceWizardTemplateDefaultValue("details.status", "draft", starter), "draft");
  });

  it("SDK-WIZ-03 rejects non-digit number defaults", () => {
    const plugin = {
      fieldRegistry: {
        version: 1,
        fields: [
          {
            id: "capacityMax",
            canonicalPath: "capacityMax",
            stepId: "basics",
            kind: "number" as const,
            required: false,
          },
        ],
      },
    };
    assert.equal(coerceWizardTemplateDefaultValue("capacityMax", "12.5", plugin), null);
    assert.equal(coerceWizardTemplateDefaultValue("capacityMax", "42", plugin), "42");
  });
});
