import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "../src/reference/starter-workspace.plugin";
import {
  findWizardTemplateRenderPlanGaps,
  listWizardTemplateEnginePlanSyncErrors,
  resolveWizardTemplateParityBaselineDimensions,
} from "../src/wizard/wizard-template-engine-parity";

describe("wizard-template-engine-parity", () => {
  it("SDK-WIZ-014-01 reports unknown engine field gaps", () => {
    const gaps = findWizardTemplateRenderPlanGaps(
      [{ stepId: "basics", fields: [{ canonicalPath: "basics.title" }] }],
      [
        {
          stepId: "basics",
          enabled: true,
          fields: [{ canonicalPath: "basics.title" }, { canonicalPath: "not.in.plan" }],
        },
      ]
    );
    assert.deepEqual(listWizardTemplateEnginePlanSyncErrors(gaps), [
      {
        code: "WIZARD_TEMPLATE_ENGINE_PLAN_GAP",
        stepId: "basics",
        canonicalPath: "not.in.plan",
      },
    ]);
  });

  it("SDK-WIZ-014-02 ignores hidden composite child rows", () => {
    const gaps = findWizardTemplateRenderPlanGaps(
      [{ stepId: "pricing", fields: [{ canonicalPath: "participants.minimumAge" }] }],
      [
        {
          stepId: "pricing",
          enabled: true,
          fields: [
            { canonicalPath: "participants.minimumAge" },
            { canonicalPath: "participants.fitnessLevel", hidden: true },
          ],
        },
      ]
    );
    assert.equal(listWizardTemplateEnginePlanSyncErrors(gaps).length, 0);
  });

  it("SDK-WIZ-014-03 starter baseline dimensions use variant default", () => {
    const starter = getStarterWorkspacePlugin();
    assert.deepEqual(resolveWizardTemplateParityBaselineDimensions(starter), { variant: "default" });
  });
});
