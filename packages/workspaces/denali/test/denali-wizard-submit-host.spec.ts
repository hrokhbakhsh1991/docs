import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import {
  submitDenaliCreateTourViaWizardHost,
  submitDenaliCreateTourViaWizardHostWithCatalogLoader,
} from "../src/wizard/denali-wizard-submit-payload";
import { validateDenaliCreateTourSubmitSync } from "../src/wizard/denali-wizard-validation";

describe("denali-wizard-submit-host.spec.ts (P15-W-C1)", () => {
  it("submitDenaliCreateTourViaWizardHost throws when wizardHost hook missing", async () => {
    const plugin = { wizardHost: undefined } as unknown as WorkspacePlugin;
    const rules = await loadDenaliWizardRulesModule();
    await assert.rejects(
      () =>
        submitDenaliCreateTourViaWizardHost({
          plugin,
          draft: { data: { title: "Test" } },
          rulesModule: rules,
          evalContext: buildDenaliWizardRuleEvalContext(),
          catalog: {},
        }),
      /WIZARD_SUBMIT_NOT_CONFIGURED/
    );
  });

  it("submitDenaliCreateTourViaWizardHostWithCatalogLoader loads catalog then submits", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const evalContext = buildDenaliWizardRuleEvalContext();
    let catalogLoaded = false;

    const payload = await submitDenaliCreateTourViaWizardHostWithCatalogLoader({
      plugin,
      draft: {
        data: {
          title: "Alborz hike",
          category: "mountain_day",
          publishStatus: "draft",
        },
      },
      rulesModule: rules,
      evalContext,
      loadCatalog: async () => {
        catalogLoaded = true;
        return { activeThemeIds: ["t1"] };
      },
    });

    assert.equal(catalogLoaded, true);
    assert.equal((payload as CreateTourPayload).schemaVersion, 1);
    assert.equal((payload.data as Record<string, unknown>).title, "Alborz hike");
  });
});

describe("denali-wizard-submit-validation.spec.ts (P15-W-C1)", () => {
  it("validateDenaliCreateTourSubmitSync requires eval context for active publish", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const result = validateDenaliCreateTourSubmitSync({
      plugin,
      draft: { data: { publishStatus: "active", title: "x", category: "mountain_day" } },
      rulesModule: rules,
      tenantId: "tenant",
      evalContext: undefined,
    });
    assert.equal(result.kind, "rules-not-ready");
  });

  it("validateDenaliCreateTourSubmitSync validates draft publishStatus without eval context", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const rules = await loadDenaliWizardRulesModule();
    const result = validateDenaliCreateTourSubmitSync({
      plugin,
      draft: { data: { publishStatus: "draft", title: "x", category: "mountain_day" } },
      rulesModule: rules,
      tenantId: "tenant",
      evalContext: undefined,
    });
    assert.equal(result.kind, "ok");
    assert.equal(typeof result.validation.ok, "boolean");
  });
});
