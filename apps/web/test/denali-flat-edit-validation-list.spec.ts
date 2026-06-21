/**
 * Phase 4 — flat edit validation list uses code → i18n (WEB-P11-5-08)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { resolveWizardValidationIssueMessage } from "../src/wizard/resolve-wizard-validation-issue-message";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("denali-flat-edit-validation-list.spec.ts — Phase 4", () => {
  it("WEB-P11-5-08 flat edit list module uses shared validation i18n resolver", () => {
    const source = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspaces/denali/src/ui/chrome/denali-flat-edit-validation-list.tsx"
      ),
      "utf8"
    );
    assert.match(source, /resolveWizardValidationIssueMessage/);
    assert.match(source, /denali\.review\.validation/);
  });

  it("translated REQUIRED_FIELD_EMPTY wins over platform message (flat edit contract)", () => {
    const message = resolveWizardValidationIssueMessage(
      {
        path: "title",
        code: "REQUIRED_FIELD_EMPTY",
        message: 'Required text at "title" is empty',
      },
      {
        has: (key) => key === "REQUIRED_FIELD_EMPTY",
        translate: (key, values) => `${values.field} — ${key}`,
      },
      "Tour title"
    );
    assert.equal(message, "Tour title — REQUIRED_FIELD_EMPTY");
  });
});
