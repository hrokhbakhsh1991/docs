/**
 * Wave H.l.b — operator datetime chrome (no Denali time-picker brand in shell + theme).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const DENALI_THEME = join(REPO_ROOT, "packages/workspaces/denali/theme");

/** Build legacy Denali tokens without embedding the forbidden substring in this file. */
function legacyDenaliAttr(...suffixParts: string[]): RegExp {
  return new RegExp(`data-${["denali", ...suffixParts].join("-")}`);
}

describe("Wave H.l.b — operator datetime chrome", () => {
  it("H.l.b-01 shell i18n components use operator time/calendar hooks", () => {
    const files = [
      "src/components/i18n/time-picker-panel.tsx",
      "src/components/i18n/workspace-time-picker.tsx",
      "src/components/i18n/localized-date-picker.tsx",
      "src/components/i18n/localized-datetime-picker.tsx",
      "src/components/ui/calendar.tsx",
    ];
    const forbidden = [
      /denali-time-picker/,
      legacyDenaliAttr("wizard", "time"),
      legacyDenaliAttr("time", "picker"),
      legacyDenaliAttr("date", "picker"),
      legacyDenaliAttr("wizard", "calendar"),
      /\bDenaliTimeInput\b/,
      /\bDenaliWizardDatetimePicker\b/,
    ];
    for (const rel of files) {
      const source = readFileSync(join(WEB_ROOT, rel), "utf8");
      for (const re of forbidden) {
        assert.doesNotMatch(source, re, `${rel} still matches ${re}`);
      }
    }
    const datetime = readFileSync(
      join(WEB_ROOT, "src/components/i18n/localized-datetime-picker.tsx"),
      "utf8"
    );
    assert.match(datetime, /useOperatorUiSurface|ensureOperatorUiComponentsSurface/);
    assert.match(datetime, /TimeInput|WizardDatetimePicker/);
  });

  it("H.l.b-02 denali theme CSS targets operator time chrome", () => {
    const calendar = readFileSync(join(DENALI_THEME, "wizard-calendar.css"), "utf8");
    const fields = readFileSync(join(DENALI_THEME, "wizard-fields.css"), "utf8");
    assert.match(calendar, /\.operator-time-picker\b/);
    assert.match(calendar, /data-operator-wizard-time-popover/);
    assert.doesNotMatch(calendar, /denali-time-picker/);
    assert.doesNotMatch(fields, legacyDenaliAttr("time", "picker"));
    assert.match(fields, /data-operator-time-picker/);
  });

  it("H.l.b-03 operator UI surface is registry/capability-only (binder deleted)", () => {
    const registry = readFileSync(
      join(WEB_ROOT, "src/wizard/operator-ui-components-registry.ts"),
      "utf8"
    );
    assert.match(registry, /ensureOperatorUiComponentsSurface|peekOperatorUiComponentsSurface/);
    assert.match(registry, /resolveOperatorUiCapability/);
    assert.doesNotMatch(registry, /workspace-operator-ui-components-bindings/);
    assert.equal(
      existsSync(
        join(WEB_ROOT, "src/bootstrap/workspace-operator-ui-components-bindings.generated.ts")
      ),
      false
    );
  });
});
