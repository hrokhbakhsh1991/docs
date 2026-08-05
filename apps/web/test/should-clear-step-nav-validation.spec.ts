import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  shouldClearStepNavValidationOnDraftChange,
  stableWizardDraftDataKey,
} from "../src/wizard/should-clear-step-nav-validation";

const here = dirname(fileURLToPath(import.meta.url));

describe("should-clear-step-nav-validation (INV-DENALI-WIZ-015)", () => {
  it("WEB-WIZ-015-01 same payload remint does not clear", () => {
    const a = stableWizardDraftDataKey({ data: { title: "Tour", category: "mountain_day" } });
    const b = stableWizardDraftDataKey({ data: { title: "Tour", category: "mountain_day" } });
    assert.equal(a, b);
    assert.equal(
      shouldClearStepNavValidationOnDraftChange({
        previousDataKey: a,
        nextDataKey: b,
        issueCount: 4,
      }),
      false
    );
  });

  it("WEB-WIZ-015-02 real data edit clears", () => {
    const previousDataKey = stableWizardDraftDataKey({ data: { title: "Tour" } });
    const nextDataKey = stableWizardDraftDataKey({ data: { title: "Tour edited" } });
    assert.equal(
      shouldClearStepNavValidationOnDraftChange({
        previousDataKey,
        nextDataKey,
        issueCount: 2,
      }),
      true
    );
  });

  it("WEB-WIZ-015-03 no issues never clears", () => {
    assert.equal(
      shouldClearStepNavValidationOnDraftChange({
        previousDataKey: "x",
        nextDataKey: "y",
        issueCount: 0,
      }),
      false
    );
  });

  it("WEB-WIZ-015-04 first observation does not clear", () => {
    assert.equal(
      shouldClearStepNavValidationOnDraftChange({
        previousDataKey: null,
        nextDataKey: stableWizardDraftDataKey({ data: { title: "Tour" } }),
        issueCount: 3,
      }),
      false
    );
  });

  it("WEB-WIZ-015-05 host wires payload-key clear not identity-only", () => {
    const src = readFileSync(join(here, "../src/wizard/workspace-wizard-host.tsx"), "utf8");
    assert.match(src, /shouldClearStepNavValidationOnDraftChange/);
    assert.match(src, /stableWizardDraftDataKey/);
    assert.doesNotMatch(
      src,
      /useEffect\(\(\) => \{\s*if \(stepNavValidationIssues\.length > 0\) \{\s*setStepNavValidationIssues\(\[\]\);\s*\}\s*\}, \[draft\]\)/
    );
  });
});
