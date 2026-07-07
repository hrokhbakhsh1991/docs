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

let denaliWizardRulesPromise: Promise<DenaliWizardRulesModule> | null = null;

/** Lazy Denali wizard rules — web entry for evaluateFormRules (Phase 6.3 / P0 PR-1). */
export function loadDenaliWizardRulesModule(): Promise<DenaliWizardRulesModule> {
  denaliWizardRulesPromise ??= import("../denali.plugin").then(
    (mod) =>
      Object.freeze({
        evaluateFormFieldRule: mod.evaluateFormFieldRule,
        applyDenaliInvariantState: mod.applyDenaliInvariantState,
        resolveDenaliRuleSetFromTemplate: mod.resolveDenaliRuleSetFromTemplate,
        buildDefaultForm: mod.buildDenaliTourCreateDefaultValues,
        readCanonicalBasics: mod.readDenaliCanonicalBasics,
        canonicalToFormPathMap: mod.DENALI_CANONICAL_TO_FORM_PATH_MAP,
        tourKindValues: mod.DENALI_TOUR_KIND_VALUES,
      }) as unknown as DenaliWizardRulesModule
  );
  return denaliWizardRulesPromise;
}
