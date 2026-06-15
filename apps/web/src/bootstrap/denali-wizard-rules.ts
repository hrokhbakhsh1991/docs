import {
  evaluateFormFieldRule,
  applyDenaliInvariantState,
  resolveDenaliRuleSetFromTemplate,
  buildDenaliTourCreateDefaultValues,
  readDenaliCanonicalBasics,
  DENALI_CANONICAL_TO_FORM_PATH_MAP,
  DENALI_TOUR_KIND_VALUES,
} from "@app-tour/workspace-denali/plugin";

export type DenaliWizardRulesModule = {
  readonly evaluateFormFieldRule: (
    form: Record<string, unknown>,
    path: string,
    step: string,
    options?: {
      readonly uiOptions?: {
        readonly workspaceFormProfile?: string;
        readonly mainThemeFormProfile?: string;
      };
      readonly ruleSet?: unknown;
    }
  ) => {
    readonly visible: boolean;
    readonly required: boolean;
  };
  readonly applyDenaliInvariantState: (
    form: Record<string, unknown>,
    uiOptions?: {
      readonly workspaceFormProfile?: string;
      readonly mainThemeFormProfile?: string;
    },
    ruleSet?: unknown
  ) => Record<string, unknown>;
  readonly resolveDenaliRuleSetFromTemplate: (template: {
    readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
  }) => unknown;
  readonly buildDefaultForm: () => Record<string, unknown>;
  readonly readCanonicalBasics: (
    tourKind: string | undefined
  ) => { readonly category: string; readonly duration: string } | null;
  readonly canonicalToFormPathMap: Readonly<Record<string, string>>;
  readonly tourKindValues: readonly string[];
};

let denaliWizardRulesModule: DenaliWizardRulesModule | null = null;
let denaliWizardRulesPromise: Promise<DenaliWizardRulesModule> | null = null;

function createDenaliWizardRulesModule(): DenaliWizardRulesModule {
  return Object.freeze({
    evaluateFormFieldRule,
    applyDenaliInvariantState,
    resolveDenaliRuleSetFromTemplate,
    buildDefaultForm: buildDenaliTourCreateDefaultValues,
    readCanonicalBasics: readDenaliCanonicalBasics,
    canonicalToFormPathMap: DENALI_CANONICAL_TO_FORM_PATH_MAP,
    tourKindValues: DENALI_TOUR_KIND_VALUES,
  }) as unknown as DenaliWizardRulesModule;
}

/**
 * Sync Denali rules for routes that already static-import the Denali plugin (create-tour, template).
 */
export function getDenaliWizardRulesModuleSync(): DenaliWizardRulesModule {
  denaliWizardRulesModule ??= createDenaliWizardRulesModule();
  return denaliWizardRulesModule;
}

/**
 * Lazy Denali wizard rules — sole web entry for evaluateFormRules (Phase 6.3).
 * Loaded via dynamic import so starter routes avoid bundling denali-domain rules.
 */
export function loadDenaliWizardRulesModule(): Promise<DenaliWizardRulesModule> {
  denaliWizardRulesPromise ??= import("@app-tour/workspace-denali/plugin").then(() =>
    getDenaliWizardRulesModuleSync()
  );
  return denaliWizardRulesPromise;
}
