/**
 * P7-1-N-005 — staging publish validation engine probe (same path as wizard submit).
 * Run on VPS: cd /opt/app-tour-staging && pnpm exec tsx scripts/p7-staging-publish-validation-engine-probe.ts
 */
import assert from "node:assert/strict";

import { DENALI_SMOKE_TENANT_ID, getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { emptyDenaliTourWizardDraft } from "@app-tour/workspace-denali/draft/tour-wizard";
import { loadDenaliWizardRulesModule } from "@app-tour/workspace-denali/wizard/rules-loader";
import { buildDenaliWizardRuleEvalContext } from "@app-tour/workspace-denali/wizard/submit";
import {
  validateDenaliCreateTourSubmitSync,
} from "@app-tour/workspace-denali/wizard/validation";
import {
  validateDenaliPublishTransitionSync,
} from "@app-tour/workspace-denali/ui/chrome/wizard-validation";

async function main(): Promise<void> {
  const rules = await loadDenaliWizardRulesModule();
  const plugin = getDenaliWorkspacePlugin();
  const ctx = buildDenaliWizardRuleEvalContext();
  const draft = emptyDenaliTourWizardDraft();

  const submit = validateDenaliCreateTourSubmitSync({
    plugin,
    draft: draft as unknown as Record<string, unknown>,
    rulesModule: rules,
    tenantId: DENALI_SMOKE_TENANT_ID,
    evalContext: ctx,
  });
  assert.equal(submit.kind, "ok", "expected validation result wrapper");
  assert.equal(submit.validation.ok, false, "empty draft must fail create submit validation");
  assert.ok(submit.validation.violations.length > 0, "submit validation must emit violations");

  const publish = validateDenaliPublishTransitionSync(
    plugin,
    draft,
    rules,
    DENALI_SMOKE_TENANT_ID,
    ctx
  );
  assert.equal(publish.ok, false, "empty draft must fail publish transition");
  assert.ok(publish.violations.length > 1, "publish transition must emit multiple violations");

  console.log(
    "P7_STAGING_PUBLISH_VALIDATION_ENGINE_OK",
    `submitViolations=${submit.validation.violations.length}`,
    `publishViolations=${publish.violations.length}`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
