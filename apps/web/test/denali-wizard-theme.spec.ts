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
      "wizard-review.css",
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

  it("WEB-DENALI-WIZARD-05 globals imports admin-bootstrap only", () => {
    const globals = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
    assert.match(globals, /admin-bootstrap\.css/);
    assert.doesNotMatch(globals, /workspace-wizard__step-title/);
  });

  it("WEB-DENALI-WIZARD-06 wizard skin re-binds dark primary on page root", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(
      skin,
      /html\.dark:has\(body\[data-workspace-plugin="denali"\]\) \[data-new-tour-wizard\][\s\S]*--color-primary:\s*var\(--color-primary\)/
    );
  });

  it("WEB-DENALI-WIZARD-07 step shell avoids tailwind layout utilities", () => {
    const shell = readFileSync(join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /space-y-/);
    const adminAppearance = readFileSync(
      join(REPO_ROOT, "packages/design-tokens/src/operator-admin-appearance.css"),
      "utf8"
    );
    assert.match(adminAppearance, /\.workspace-wizard-shell\s*\{[\s\S]*gap:/);
  });

  it("WEB-DENALI-WIZARD-11 wizard datetime BEM + bridge primitive toggle (WZ-P1)", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /\[data-operator-wizard-datetime\]/);
    assert.match(fields, /operator-wizard-datetime__control/);
    assert.match(fields, /\[data-operator-time-picker\]/);
    assert.match(fields, /operator-time-picker-trigger/);
    const calendar = readFileSync(join(DENALI_THEME_DIR, "wizard-calendar.css"), "utf8");
    assert.match(calendar, /\[data-operator-wizard-time-popover\]/);
    assert.match(calendar, /operator-time-picker__column/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /wizard-bridge-shell__theme-toggle/);
    assert.match(skin, /--color-surface:\s*var\(--color-bg-surface\)/);
    const datetimePicker = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspaces/denali/src/ui/components/localized-datetime-picker.tsx"
      ),
      "utf8"
    );
    assert.match(datetimePicker, /operator-wizard-datetime/);
    assert.match(datetimePicker, /data-operator-wizard-datetime/);
    assert.match(datetimePicker, /operator-wizard-datetime__control/);
    assert.match(datetimePicker, /appearance="inline"/);
    const bridge = readFileSync(
      join(import.meta.dirname, "../src/shell/wizard-bridge-shell.tsx"),
      "utf8"
    );
    assert.match(bridge, /WizardBridgeThemeToggle/);
    assert.doesNotMatch(bridge, /OperatorThemeToggleButton/);
    const denaliDatetime = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-datetime-field.tsx"),
      "utf8"
    );
    assert.match(denaliDatetime, /DenaliWizardDatetimePicker/);
    const shellDatetimePicker = readFileSync(
      join(import.meta.dirname, "../src/components/i18n/localized-datetime-picker.tsx"),
      "utf8"
    );
    assert.match(shellDatetimePicker, /layout === "wizard"/);
    assert.match(shellDatetimePicker, /WorkspaceWizardDatetimePicker/);
  });

  it("WEB-DENALI-WIZARD-10 portal calendar skin is body-scoped (WZ-P0)", () => {
    const calendarCss = readFileSync(join(DENALI_THEME_DIR, "wizard-calendar.css"), "utf8");
    assert.match(calendarCss, /\[data-operator-wizard-calendar\]/);
    assert.match(calendarCss, /button\[aria-pressed="true"\]/);
    assert.match(
      calendarCss,
      /--operator-wizard-calendar-primary:\s*var\(--color-primary\)/
    );
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.doesNotMatch(fields, /data-selected="true"/);
    const calendar = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspaces/denali/src/ui/components/calendar/denali-calendar.tsx"
      ),
      "utf8"
    );
    assert.match(calendar, /data-operator-wizard-calendar/);
    const picker = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/components/localized-date-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /data-operator-wizard-calendar-popover/);
    assert.match(calendarCss, /operator-wizard-calendar__grid/);
    assert.match(calendarCss, /operator-wizard-calendar__picker-grid/);
    assert.match(calendarCss, /operator-wizard-calendar__title-btn/);
    assert.match(calendarCss, /operator-wizard-calendar__day--disabled/);
    assert.match(calendarCss, /operator-wizard-calendar__day--today:not\(\[aria-pressed="true"\]\)/);
  });

  it("WEB-DENALI-WIZARD-16 social media kind toggle BEM", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-social-media__kind-btn/);
    const social = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-social-media-link-field.tsx"),
      "utf8"
    );
    assert.match(social, /data-operator-social-media-link/);
    const registry = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/composites/denali-composite-registry.ts"),
      "utf8"
    );
    assert.match(registry, /socialMediaLink: "denali\.social-media-link"/);
  });

  it("WEB-DENALI-WIZARD-15 leader picker card grid BEM", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-leader-picker__grid/);
    assert.match(fields, /denali-leader-picker__card--selected/);
    const leaders = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-leader-user-ids-field.tsx"),
      "utf8"
    );
    assert.match(leaders, /data-operator-leader-picker/);
    assert.doesNotMatch(leaders, /Checkbox/);
  });

  it("WEB-DENALI-WIZARD-09 photo grid BEM in wizard-fields.css", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__photos-layout/);
    const photos = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /data-operator-wizard-photo-grid/);
  });

  it("WEB-DENALI-WIZARD-20 select chevron inset for RTL wizard fields", () => {
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-searchable-select__trigger-icon[\s\S]*margin-inline:/);
    assert.match(
      fields,
      /\[dir="rtl"\][\s\S]*denali-searchable-select__trigger[\s\S]*padding-inline-start:/
    );
    const selectCss = readFileSync(
      join(REPO_ROOT, "packages/ui-primitives/src/Select/select-affordance.css"),
      "utf8"
    );
    assert.match(selectCss, /appearance:\s*none/);
    assert.match(selectCss, /background-position:\s*right var\(--select-chevron-inset\) center/);
    assert.match(
      selectCss,
      /\[dir="rtl"\][\s\S]*background-position:\s*left var\(--select-chevron-inset\) center/
    );
    assert.match(fields, /\[dir="rtl"\][\s\S]*select[\s\S]*background-position:\s*left var\(--select-chevron-inset\) center/);
  });

  it("WEB-DENALI-WIZARD-12 composite UX phase 3 (WZ-P1-06…10)", () => {
    const stepper = readFileSync(join(DENALI_THEME_DIR, "wizard-stepper.css"), "utf8");
    assert.match(stepper, /data-wizard-step-state="upcoming"/);
    assert.match(stepper, /border-style:\s*dashed/);
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__subtitle/);
    assert.match(fields, /denali-gear-picker__grid/);
    assert.match(fields, /\[data-operator-wizard-file-input\]/);
    const photos = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /denali-wizard-composite__photo-card/);
    assert.doesNotMatch(photos, /__panel.*__photo-card|__photo-card.*__panel/);
    assert.match(photos, /data-operator-wizard-file-input/);
    const gear = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-gear-field.tsx"),
      "utf8"
    );
    assert.match(gear, /data-operator-gear-picker/);
    assert.match(gear, /denali-gear-picker__grid/);
    assert.match(gear, /denali-gear-picker__requirement/);
    assert.match(gear, /resolveEquipmentCatalogSubtitle/);
    assert.match(gear, /EquipmentCatalogAvatar/);
    assert.match(gear, /DENALI_SUBMIT_CATALOG_BFF_PATHS\.tourThemes/);
    assert.doesNotMatch(gear, /\{item\.category\}/);
    assert.doesNotMatch(gear, /denali-wizard-composite__panel/);
    const gathering = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-gathering-points-field.tsx"),
      "utf8"
    );
    assert.match(gathering, /<h3 className="denali-wizard-composite__title">/);
    const locationZones = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-location-zones-field.tsx"),
      "utf8"
    );
    assert.match(locationZones, /<h3 className="denali-wizard-composite__title">/);
    const itinerary = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-itinerary-field.tsx"),
      "utf8"
    );
    assert.match(itinerary, /denali-wizard-composite__subtitle/);
  });

  it("WEB-DENALI-WIZARD-14 infrastructure hardening (phase 4b)", () => {
    const compositeRegistry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-composite-surface-registry.tsx"),
      "utf8"
    );
    assert.match(compositeRegistry, /resolveGeneratedCompositeSurface/);
    const generatedSurfaces = readFileSync(
      join(import.meta.dirname, "../src/bootstrap/wizard-surface-bindings.generated.ts"),
      "utf8"
    );
    assert.match(generatedSurfaces, /@app-tour\/workspace-denali\/host\/ui\/composite-surface/);
    const wizardField = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-field.tsx"),
      "utf8"
    );
    assert.match(wizardField, /resolveWizardCompositeSurface/);
    assert.doesNotMatch(wizardField, /denali-composite-renderers/);
    const locationZones = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-location-zones-field.tsx"),
      "utf8"
    );
    assert.match(locationZones, /<h3 className="denali-wizard-composite__title">/);
    const gear = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-gear-field.tsx"),
      "utf8"
    );
    assert.match(gear, /denali-wizard-composite__error/);
    const photos = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-photos-field.tsx"),
      "utf8"
    );
    assert.match(photos, /isDenaliHttpsImageUrl/);
    assert.match(photos, /isDenaliWizardDraftSessionId/);
    const orchestrationHook = readFileSync(
      join(import.meta.dirname, "../src/wizard/use-create-tour-wizard.ts"),
      "utf8"
    );
    assert.match(orchestrationHook, /createWizardAssetSessionId/);
    const schema = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/schemas/denaliFileAssetSchema.ts"),
      "utf8"
    );
    assert.match(schema, /isDenaliHttpsImageUrl/);
  });

  it("WEB-DENALI-WIZARD-14 content-quality styles live in denali skin only", () => {
    const adminAppearance = readFileSync(
      join(REPO_ROOT, "packages/design-tokens/src/operator-admin-appearance.css"),
      "utf8"
    );
    assert.doesNotMatch(adminAppearance, /\.denali-wizard-content-quality/);
    const review = readFileSync(join(DENALI_THEME_DIR, "wizard-review.css"), "utf8");
    assert.match(review, /\.denali-wizard-content-quality/);
    assert.match(review, /body\[data-workspace-plugin="denali"\]/);
  });

  it("WEB-DENALI-WIZARD-13 phase 4 maintenance (WZ-P2-01…05)", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /wizard-bridge-shell__back--primary/);
    assert.doesNotMatch(skin, /scaleX\(-1\)/);
    const adminAppearance = readFileSync(
      join(REPO_ROOT, "packages/design-tokens/src/operator-admin-appearance.css"),
      "utf8"
    );
    assert.match(adminAppearance, /data-wizard-step-state="current"/);
    assert.doesNotMatch(adminAppearance, /data-step-state/);
    const stepShell = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"),
      "utf8"
    );
    assert.match(stepShell, /data-wizard-step-state=\{state\}/);
    assert.doesNotMatch(stepShell, /data-step-state/);
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /denali-wizard-composite__map-skeleton/);
    const mapPreview = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/components/denali-map-preview.tsx"),
      "utf8"
    );
    assert.match(mapPreview, /data-operator-wizard-map-preview/);
    const interactions = readFileSync(join(DENALI_THEME_DIR, "wizard-interactions.css"), "utf8");
    assert.match(interactions, /prefers-reduced-motion: reduce/);
    assert.match(interactions, /denali-wizard-step-in 0\.18s/);
  });

  it("WEB-DENALI-WIZARD-17 tour kind uses visible segmented category and duration controls", () => {
    const bridge = readFileSync(
      join(import.meta.dirname, "../src/shell/wizard-bridge-shell.tsx"),
      "utf8"
    );
    assert.match(bridge, /ChevronRight/);
    assert.match(bridge, /ChevronLeft/);
    const tourKind = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-tour-kind-field.tsx"),
      "utf8"
    );
    assert.match(tourKind, /patchDenaliCanonicalBasics/);
    assert.match(tourKind, /denali-tour-kind__choice/);
    assert.match(tourKind, /denali-tour-kind__picker/);
    assert.match(tourKind, /denali-tour-kind__current/);
    assert.doesNotMatch(tourKind, /<details/);
    assert.doesNotMatch(tourKind, /<Select/);
    const fields = readFileSync(join(DENALI_THEME_DIR, "wizard-fields.css"), "utf8");
    assert.match(fields, /\[data-operator-tour-kind\]/);
    assert.match(fields, /\.denali-tour-kind__current/);
    const chrome = readFileSync(
      join(import.meta.dirname, "../src/wizard/create-tour-wizard-chrome.tsx"),
      "utf8"
    );
    assert.match(chrome, /wizard-clear-draft/);
    assert.match(chrome, /new-tour-wizard-page__header-main/);
    const client = readFileSync(
      join(import.meta.dirname, "../app/tours/new/create-tour-wizard-client.tsx"),
      "utf8"
    );
    assert.match(client, /useOperatorCreateTourWizard/);
    assert.match(client, /CreateTourWizardHeader/);
    const stepShell = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"),
      "utf8"
    );
    assert.match(stepShell, /workspace-wizard-shell__progress-step-btn/);
    assert.match(stepShell, /canNavigateToWizardStepIndex/);
    assert.match(stepShell, /data-wizard-step-rail/);
    assert.match(stepShell, /scrollWizardStepRailItemIntoView/);
  });

  it("WEB-DENALI-WIZARD-18 wizard shell pins navigation while document scrolls", () => {
    const stepShell = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-step-shell.tsx"),
      "utf8"
    );
    assert.match(stepShell, /workspace-wizard-shell__body/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /document scrolls \(no nested form panel\)/);
    assert.match(stepShell, /workspace-wizard-shell__actions-group/);
    assert.match(stepShell, /data-wizard-nav="continue"/);
    const stepper = readFileSync(join(DENALI_THEME_DIR, "wizard-stepper.css"), "utf8");
    assert.match(stepper, /workspace-wizard-shell__actions[\s\S]*flex-shrink:\s*0/);
    assert.match(stepper, /workspace-wizard-shell__actions-group/);
    assert.match(stepper, /workspace-wizard-shell__progress-rail/);
    assert.match(stepper, /\.workspace-wizard-shell__progress-list \{[\s\S]*flex-wrap:\s*nowrap/);
    const gear = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields/denali-gear-field.tsx"),
      "utf8"
    );
    assert.match(gear, /denali-wizard-picker__scroll/);
    assert.match(gear, /filterPickerItemsByQuery/);
  });

  it("WEB-DENALI-WIZARD-19 review validation panel styles and field focus markers", () => {
    const reviewCss = readFileSync(join(DENALI_THEME_DIR, "wizard-review.css"), "utf8");
    assert.match(reviewCss, /\.operator-review-validation/);
    assert.match(reviewCss, /operator-review-validation__issue-link/);
    assert.match(reviewCss, /\.operator-review__section-header/);
    assert.match(reviewCss, /\.operator-review__hero-cover/);
    assert.match(reviewCss, /\.operator-review__photo-grid/);
    assert.match(reviewCss, /\.operator-review__gear-list/);
    const sectionTitleBlock =
      reviewCss.match(/\.operator-review__section-title\s*\{[^}]+\}/)?.[0] ?? "";
    assert.doesNotMatch(sectionTitleBlock, /text-transform:\s*uppercase/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "wizard-skin.css"), "utf8");
    assert.match(skin, /wizard-field--validation-highlight/);
    const host = readFileSync(
      join(import.meta.dirname, "../src/wizard/workspace-wizard-host.tsx"),
      "utf8"
    );
    const registry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-review-surface-registry.tsx"),
      "utf8"
    );
    assert.match(host, /wizardFieldPathAttributes/);
    assert.match(host, /resolveWizardValidationSurface/);
    assert.match(registry, /resolveGeneratedReviewSurface/);
    assert.match(registry, /renderValidationSummary/);
    const generatedSurfaces = readFileSync(
      join(import.meta.dirname, "../src/bootstrap/wizard-surface-bindings.generated.ts"),
      "utf8"
    );
    assert.match(generatedSurfaces, /@app-tour\/workspace-denali\/host\/ui\/review-surface/);
  });

  it("WEB-DENALI-WIZARD-08 composites avoid tailwind utility classes", () => {
    const dirs = [
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/fields"),
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/surfaces"),
      join(REPO_ROOT, "packages/workspaces/denali/src/ui/review"),
    ];
    const tailwindInClassName =
      /className=["'][^"']*\b(?:flex|grid-cols|grid-rows|gap-|space-|text-|max-h-|h-48|w-full|rounded-md|object-contain|sm:)/;
    const tailwindExempt = new Set(["denali-flat-edit-form.tsx"]);
    for (const dir of dirs) {
      for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
        if (tailwindExempt.has(file)) {
          continue;
        }
        const content = readFileSync(join(dir, file), "utf8");
        assert.doesNotMatch(content, tailwindInClassName, `tailwind utilities in ${file}`);
      }
    }
  });
});
