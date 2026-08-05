import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveWizardValidationHeadingKey,
  type WizardCompositeA11yProps,
} from "@app-tour/wizard-navigation";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const repoRoot = join(webRoot, "../..");

function extractCompositeA11yBlock(source: string): string {
  const match = source.match(
    /export type WizardCompositeFieldRenderProps[\s\S]*?=\s*([\s\S]*?);/
  );
  assert.ok(match?.[1], "WizardCompositeFieldRenderProps not found");
  return match[1];
}

describe("wizard-surface-contracts (INV-DENALI-WIZ-017)", () => {
  it("WEB-WIZ-017-01 resolveWizardValidationHeadingKey defaults to create heading", () => {
    assert.equal(resolveWizardValidationHeadingKey(undefined), "review.validationHeading");
    assert.equal(
      resolveWizardValidationHeadingKey("review.stepValidationHeading"),
      "review.stepValidationHeading"
    );
  });

  it("WEB-WIZ-017-02 host Continue passes stepValidationHeading", () => {
    const src = readFileSync(
      join(webRoot, "src/wizard/workspace-wizard-host.tsx"),
      "utf8"
    );
    assert.match(
      src,
      /validationHeadingKey:\s*"review\.stepValidationHeading"/
    );
  });

  it("WEB-WIZ-017-03 web + denali composite props extend WizardCompositeA11yProps", () => {
    const web = readFileSync(
      join(webRoot, "src/wizard/wizard-surface-types.ts"),
      "utf8"
    );
    const denali = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/surfaces/wizard-surface-types.ts"
      ),
      "utf8"
    );
    assert.match(web, /WizardCompositeA11yProps/);
    assert.match(denali, /WizardCompositeA11yProps/);
    assert.match(web, /WizardCompositeFieldRenderProps = WizardCompositeA11yProps/);
    assert.match(denali, /WizardCompositeFieldRenderProps = WizardCompositeA11yProps/);

    const webBlock = extractCompositeA11yBlock(web);
    const denaliBlock = extractCompositeA11yBlock(denali);
    assert.match(webBlock, /WizardCompositeA11yProps/);
    assert.match(denaliBlock, /WizardCompositeA11yProps/);

    // Compile-time shape reference — keeps the shared contract imported.
    const sample: WizardCompositeA11yProps = {
      invalid: true,
      validationIssuePaths: ["program.shortDescription"],
    };
    assert.equal(sample.invalid, true);
  });

  it("WEB-WIZ-017-04 denali validation types include validationHeadingKey", () => {
    const denali = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/surfaces/wizard-surface-types.ts"
      ),
      "utf8"
    );
    assert.match(denali, /validationHeadingKey\?:/);
    const summary = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/review/denali-review-validation-summary.tsx"
      ),
      "utf8"
    );
    assert.match(summary, /resolveWizardValidationHeadingKey/);
    assert.match(summary, /data-validation-heading/);
  });
});
