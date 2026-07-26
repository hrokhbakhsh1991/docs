/**
 * Public export path for Denali wizard rules (`host/wizard/rules-loader`).
 * Implementation lives on host-hooks so the plugin graph stays the single owner
 * (avoids broken `denali.plugin` symbol fan-out that never re-exported rules).
 */
export type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
export { loadDenaliWizardRulesModule } from "./denali-wizard-host-hooks";
