/**
 * Denali wizard theme + Wizard Bridge contracts.
 * @see docs/workspaces/denali/wizard-experience.md
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { WIZARD_BRIDGE_TEST_IDS } from "../src/shell/wizard-bridge.types";

const REPO_ROOT = join(import.meta.dirname, "../../..");
const DENALI_THEME_DIR = join(REPO_ROOT, "packages/workspaces/denali/theme");

describe("denali-wizard-theme.spec.ts", () => {
  it("WEB-DENALI-WIZARD-01 bundles wizard CSS in denali-admin.css", () => {
    const bundle = readFileSync(join(DENALI_THEME_DIR, "denali-admin.css"), "utf8");
    for (const file of [
      "wizard-skin.css",
      "wizard-stepper.css",
      "wizard-fields.css",
      "wizard-calendar.css",
      "wizard-interactions.css",
    ]) {
      assert.match(bundle, new RegExp(file.replace(".", "\\.")));
    }
  });

  it("WEB-DENALI-WIZARD-02 wizard skin scopes to data-new-tour-wizard", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /data-new-tour-wizard/);
    assert.match(skin, /wizard-bridge-shell/);
  });

  it("WEB-DENALI-WIZARD-03 tours layout uses ToursWizardLayout", () => {
    const layout = readFileSync(join(import.meta.dirname, "../app/tours/layout.tsx"), "utf8");
    assert.match(layout, /ToursWizardLayout/);
    assert.doesNotMatch(layout, /Phase3ShellLayout/);
  });

  it("WEB-DENALI-WIZARD-04 bridge test ids are stable", () => {
    assert.equal(WIZARD_BRIDGE_TEST_IDS.shell, "wizard-bridge-shell");
    assert.equal(WIZARD_BRIDGE_TEST_IDS.backTours, "wizard-bridge-back-tours");
  });

  it("WEB-DENALI-WIZARD-05 globals keeps platform fallback only", () => {
    const globals = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
    assert.match(globals, /platform fallback/);
    assert.doesNotMatch(globals, /workspace-wizard__step-title/);
  });

  it("WEB-DENALI-WIZARD-06 wizard skin re-binds dark primary on page root", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(
      skin,
      /html\.dark:has\(body\[data-workspace-plugin="denali"\]\) \[data-new-tour-wizard\][\s\S]*--color-primary:\s*#5eead4/
    );
  });

  it("WEB-DENALI-WIZARD-07 step shell avoids tailwind layout utilities", () => {
    const shell = readFileSync(join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /space-y-/);
    const globals = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
    assert.match(globals, /\.workspace-wizard-shell\s*\{[\s\S]*gap:/);
  });

  it("WEB-DENALI-WIZARD-11 wizard datetime BEM + bridge primitive toggle (WZ-P1)", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /\[data-denali-wizard-datetime\]/);
    assert.match(fields, /denali-wizard-datetime__clock-digit/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /wizard-bridge-shell__theme-toggle/);
    assert.match(skin, /--color-surface:\s*var\(--color-bg-surface\)/);
    const datetimePicker = readFileSync(
      join(import.meta.dirname, "../src/components/i18n/localized-datetime-picker.tsx"),
      "utf8"
    );
    assert.match(datetimePicker, /layout === "wizard"/);
    assert.match(datetimePicker, /data-denali-wizard-datetime/);
    assert.match(datetimePicker, /variant="primitive"/);
    const bridge = readFileSync(
      join(import.meta.dirname, "../src/shell/wizard-bridge-shell.tsx"),
      "utf8"
    );
    assert.match(bridge, /WizardBridgeThemeToggle/);
    assert.doesNotMatch(bridge, /OperatorThemeToggleButton/);
    const denaliDatetime = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-datetime-field.tsx"),
      "utf8"
    );
    assert.match(denaliDatetime, /layout="wizard"/);
  });

  it("WEB-DENALI-WIZARD-10 portal calendar skin is body-scoped (WZ-P0)", () => {
    const calendarCss = readFileSync(join(DENALI_THEME_DIR, "wizard-calendar.css"), "utf8");
    assert.match(calendarCss, /\[data-denali-wizard-calendar\]/);
    assert.match(calendarCss, /button\[aria-pressed="true"\]/);
    assert.match(
      calendarCss,
      /html\.dark:has\(body\[data-workspace-plugin="denali"\]\)[\s\S]*--denali-wizard-calendar-primary:\s*#5eead4/
    );
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.doesNotMatch(fields, /data-selected="true"/);
    const calendar = readFileSync(
      join(import.meta.dirname, "../src/components/ui/calendar.tsx"),
      "utf8"
    );
    assert.match(calendar, /data-denali-wizard-calendar/);
    const picker = readFileSync(
      join(import.meta.dirname, "../src/components/i18n/localized-date-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /data-denali-wizard-calendar-popover/);
  });

  it("WEB-DENALI-WIZARD-09 photo grid BEM in wizard-fields.css", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__photos-layout/);
    const photos = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /data-denali-wizard-photo-grid/);
  });

  it("WEB-DENALI-WIZARD-12 composite UX phase 3 (WZ-P1-06…10)", () => {
    const stepper = readFileSync(join(DENALI_THEME_DIR, "wizard-stepper.css"), "utf8");
    assert.match(stepper, /data-wizard-step-state="upcoming"/);
    assert.match(stepper, /border-style:\s*dashed/);
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__subtitle/);
    assert.match(fields, /denali-wizard-composite__gear-item/);
    assert.match(fields, /\[data-denali-wizard-file-input\]/);
    const photos = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /denali-wizard-composite__photo-card/);
    assert.doesNotMatch(photos, /__panel.*__photo-card|__photo-card.*__panel/);
    assert.match(photos, /data-denali-wizard-file-input/);
    const gear = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-gear-field.tsx"),
      "utf8"
    );
    assert.match(gear, /data-denali-wizard-gear-list/);
    assert.match(gear, /denali-wizard-composite__list-item/);
    assert.doesNotMatch(gear, /denali-wizard-composite__panel/);
    const gathering = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-gathering-points-field.tsx"),
      "utf8"
    );
    assert.match(gathering, /<h3 className="denali-wizard-composite__title">/);
    const locationZones = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-location-zones-field.tsx"),
      "utf8"
    );
    assert.match(locationZones, /<h3 className="denali-wizard-composite__title">/);
    const itinerary = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-itinerary-field.tsx"),
      "utf8"
    );
    assert.match(itinerary, /denali-wizard-composite__subtitle/);
  });

  it("WEB-DENALI-WIZARD-14 infrastructure hardening (phase 4b)", () => {
    const compositeRegistry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-composite-surface-registry.tsx"),
      "utf8"
    );
    assert.match(compositeRegistry, /dynamic\(/);
    assert.match(compositeRegistry, /denali-composite-field/);
    const wizardField = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-field.tsx"),
      "utf8"
    );
    assert.match(wizardField, /resolveWizardCompositeSurface/);
    assert.doesNotMatch(wizardField, /denali-composite-renderers/);
    const locationZones = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-location-zones-field.tsx"),
      "utf8"
    );
    assert.match(locationZones, /<h3 className="denali-wizard-composite__title">/);
    const gear = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-gear-field.tsx"),
      "utf8"
    );
    assert.match(gear, /denali-wizard-composite__error/);
    const photos = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /isDenaliHttpsImageUrl/);
    assert.match(photos, /isDenaliWizardDraftSessionId/);
    const client = readFileSync(
      join(import.meta.dirname, "../app/tours/new/new-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(client, /createDenaliWizardDraftSessionId/);
    const schema = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/schemas/denaliFileAssetSchema.ts"),
      "utf8"
    );
    assert.match(schema, /isDenaliHttpsImageUrl/);
  });

  it("WEB-DENALI-WIZARD-13 phase 4 maintenance (WZ-P2-01…05)", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /html\[dir="rtl"\][\s\S]*wizard-bridge-shell__back-icon[\s\S]*scaleX\(-1\)/);
    const globals = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
    assert.match(globals, /data-wizard-step-state="current"/);
    assert.doesNotMatch(globals, /data-step-state/);
    const stepShell = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"),
      "utf8"
    );
    assert.match(stepShell, /data-wizard-step-state=\{state\}/);
    assert.doesNotMatch(stepShell, /data-step-state/);
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__map-skeleton/);
    const mapPreview = readFileSync(
      join(import.meta.dirname, "../src/wizard/denali/denali-map-preview.tsx"),
      "utf8"
    );
    assert.match(mapPreview, /data-denali-wizard-map-preview/);
    const interactions = readFileSync(join(DENALI_THEME_DIR, "wizard-interactions.css"), "utf8");
    assert.match(interactions, /prefers-reduced-motion: reduce/);
    assert.match(interactions, /denali-wizard-step-in 0\.18s/);
  });

  it("WEB-DENALI-WIZARD-08 composites avoid tailwind utility classes", () => {
    const dir = join(import.meta.dirname, "../src/wizard/denali");
    const tailwindInClassName =
      /className=["'][^"']*\b(?:flex|grid|gap-|space-|text-|max-h-|h-48|w-full|rounded-md|object-contain|sm:grid-cols)/;
    const tailwindExempt = new Set(["denali-flat-edit-form.tsx"]);
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
      if (tailwindExempt.has(file)) {
        continue;
      }
      const content = readFileSync(join(dir, file), "utf8");
      assert.doesNotMatch(content, tailwindInClassName, `tailwind utilities in ${file}`);
    }
  });
});
