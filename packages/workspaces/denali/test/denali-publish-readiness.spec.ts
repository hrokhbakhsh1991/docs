import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import type { DenaliCreateTourWizardForm } from "../src/schemas/denaliCore.schema";
import { collectDenaliPublishReadinessRuleIssues } from "../src/validation/publishReadinessRules";

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

function loadGoldenForm(filename: string): DenaliCreateTourWizardForm {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form as DenaliCreateTourWizardForm;
}

describe("denali-publish-readiness.spec.ts — Phase 12.6", () => {
  it("DEN-12.6-01 tour-publish-ready golden has no publish-transition blockers", () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    const issues = collectDenaliPublishReadinessRuleIssues(form, undefined, {
      publishTransition: true,
    });
    assert.deepEqual(issues, []);
  });

  it("DEN-12.6-02 tour-minimal golden fails publish readiness", () => {
    const form = loadGoldenForm("tour-minimal.json");
    const issues = collectDenaliPublishReadinessRuleIssues(form, undefined, {
      publishTransition: true,
    });
    assert.ok(issues.length > 0);
  });

  it("DEN-12.6-03 skips matrix when publishStatus draft and no transition flag", () => {
    const form = loadGoldenForm("tour-minimal.json");
    assert.equal(form.basicInfo.publishStatus, "draft");
    const issues = collectDenaliPublishReadinessRuleIssues(form);
    assert.deepEqual(issues, []);
  });
});
