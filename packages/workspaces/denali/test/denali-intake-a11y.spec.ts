/**
 * BUG-6 — unique intake control ids per guest card; aria-invalid only on the failing field.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const denaliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali intake a11y — unique field ids", () => {
  it("DN-INTAKE-A11Y-01 self and other cards use distinct idPrefix; no blanket hasError", () => {
    const steps = readFileSync(
      join(denaliRoot, "src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(steps, /idPrefix="denali-intake-self"/);
    assert.match(steps, /idPrefix=\{`denali-intake-other-\$\{guestIdx\}`\}/);
    assert.match(steps, /setInvalidField\(null\)/);
    assert.match(steps, /denaliIntakeNationalIdChecksumIssue/);
    assert.doesNotMatch(steps, /hasError=\{error !== null\}/);
    assert.doesNotMatch(steps, /schema-intake-\$\{field\.id\}/);
  });
});
