/**
 * QA pnpm script registry — naming convention: qa:<module>:<type[-variant]>
 * (aligned with @apps/api scripts such as qa:denali:provision).
 *
 * Canonical names live in package.json; legacy aliases forward to these keys.
 */

/** @type {const} */
export const QA_MODULES = {
  tourWizard: "tour-wizard",
  denali: "denali",
};

/** Canonical script names (package.json keys). */
export const QA_SCRIPTS = {
  tourWizard: {
    smoke: "qa:tour-wizard:smoke",
    integrationShell: "qa:tour-wizard:integration-shell",
    integrationSubmitUrban: "qa:tour-wizard:integration-submit-urban",
    integrationSubmit: "qa:tour-wizard:integration-submit",
    integrationSubmitDenali: "qa:tour-wizard:integration-submit-denali",
    integrationSubmitDenaliMatrix: "qa:tour-wizard:integration-submit-denali-matrix",
    integrationSubmitDenaliFromPreset: "qa:tour-wizard:integration-submit-denali-from-preset",
    integrationSubmitDenaliFromPresetInWizard:
      "qa:tour-wizard:integration-submit-denali-from-preset-in-wizard",
    integrationAll: "qa:tour-wizard:integration-all",
  },
  denali: {
    smokeMapFields: "qa:denali:smoke-map-fields",
    integrationMapFields: "qa:denali:integration-map-fields",
    ownerMatrix: "qa:denali:owner-matrix",
    presetWire: "qa:denali:preset-wire",
  },
};

/** Playwright configs used by tour-wizard / denali QA scripts. */
export const QA_PLAYWRIGHT = {
  smoke: "playwright.smoke.config.ts",
  integration: "playwright.integration.config.ts",
};

/** Official Phase 0.3 gate smoke (7-spec suite) — run from repo root. */
export const QA_TOUR_WIZARD_SMOKE_GATE = QA_SCRIPTS.tourWizard.smoke;
