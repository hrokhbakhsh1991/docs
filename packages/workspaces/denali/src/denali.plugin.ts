import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

import {
  denaliRegistrationOpsManifest,
  getDenaliRegistrationOpsManifest,
} from "./bookings/ops-manifest";
import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  type FinanceOpsManifest,
} from "./finance/finance-ops-manifest";
import { toDenaliCatalogCard } from "./catalog/denali-catalog-card";
import { isDenaliTourPublished } from "./catalog/denali-publish-status";
import { extractDenaliTourListProjection } from "./list/tour-list-projection";
import {
  denaliOperatorSettingsSurface,
  getDenaliOperatorSettingsSurface,
} from "./settings/denali-settings.manifest";
import {
  buildDenaliWizardRoots,
  buildDenaliWorkspaceFieldRegistry,
  buildDenaliWorkspaceRuleSet,
} from "./denali-plugin-adapter";
import { denaliHydrateTourCloneDraft, prepareDenaliServerCloneCanonical } from "./clone";
import { denaliWizardHostHooks } from "./wizard/denali-wizard-host-hooks";
import { denaliRuleSet } from "./rules/denaliRuleModel";

/** Relative to workspace package root — published via package exports. */
export const DENALI_THEME_TOKENS_STYLESHEET = "theme/tokens.css" as const;

/** Full operator admin skin bundle (imports tokens + skin + motion). */
export const DENALI_THEME_ADMIN_STYLESHEET = "theme/denali-admin.css" as const;

export const DENALI_WORKSPACE_PLUGIN_ID = "denali" as const;
export const DENALI_WORKSPACE_TYPE = "denali" as const;

export type DenaliRegistrationPayload = {
  readonly contact: {
    readonly email: string;
    readonly fullName: string;
    readonly phone?: string;
  };
  readonly partySize: number;
};

const DENALI_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DENALI_PHONE_PATTERN = /^[\d+\-().\s]*$/;

export function validateDenaliRegistrationPayload(
  payload: DenaliRegistrationPayload,
  context: { readonly capacity: number | null }
): void {
  const email = payload.contact.email.trim();
  if (email.length < 3 || email.length > 320 || !DENALI_EMAIL_PATTERN.test(email)) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  const fullName = payload.contact.fullName.trim();
  if (fullName.length < 1 || fullName.length > 200) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  if (payload.contact.phone !== undefined) {
    const phone = payload.contact.phone.trim();
    if (phone.length > 32 || !DENALI_PHONE_PATTERN.test(phone)) {
      throw new Error("DENALI_REGISTRATION_INVALID");
    }
  }
  if (!Number.isInteger(payload.partySize) || payload.partySize < 1) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
  if (context.capacity !== null && payload.partySize > context.capacity) {
    throw new Error("DENALI_REGISTRATION_INVALID");
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const DENALI_FIELD_REGISTRY = buildDenaliWorkspaceFieldRegistry();
export const DENALI_RULE_SET = buildDenaliWorkspaceRuleSet(denaliRuleSet, DENALI_FIELD_REGISTRY);

export const DENALI_WIZARD_SURFACE = deepFreeze({
  wizardMode: "classic" as const,
  railId: "denali_base",
  roots: buildDenaliWizardRoots(),
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
});

export const DENALI_LIFECYCLE = deepFreeze({
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
});

const denaliTheme = {
  ...workspaceThemePresets["platform-primary"],
  optionalStylesheet: DENALI_THEME_ADMIN_STYLESHEET,
  cssVariables: {
    [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
  },
} as const;

export function createDenaliWorkspacePlugin(): WorkspacePlugin {
  return deepFreeze({
    id: DENALI_WORKSPACE_PLUGIN_ID,
    version: 1,
    contractVersion: 1,
    supportedWorkspaceTypes: deepFreeze([DENALI_WORKSPACE_TYPE]),
    fieldRegistry: DENALI_FIELD_REGISTRY,
    ruleSet: DENALI_RULE_SET,
    wizard: DENALI_WIZARD_SURFACE,
    validation: {
      checkCapacity: () => null,
      checkTripDetails: () => null,
    },
    lifecycle: DENALI_LIFECYCLE,
    theme: deepFreeze({ ...denaliTheme }),
    registrationOps: deepFreeze({
      manifestVersion: 1 as const,
      manifest: denaliRegistrationOpsManifest,
    }),
    operatorSettings: deepFreeze({ ...denaliOperatorSettingsSurface }),
    tourList: deepFreeze({
      extractTourListProjection: extractDenaliTourListProjection,
    }),
    publicCatalog: deepFreeze({
      isPublished: isDenaliTourPublished,
      toCatalogCard: toDenaliCatalogCard,
    }),
    tourClone: deepFreeze({
      hydrateWizardDraft: ({ canonicalData, activeEquipmentIds, wizardSessionId, tenantId }) =>
        denaliHydrateTourCloneDraft(canonicalData, {
          activeEquipmentIds,
          wizardSessionId,
          tenantId,
        }),
      prepareServerCloneCreateData: ({
        canonicalData,
        activeEquipmentIds,
      }: {
        canonicalData: Record<string, unknown>;
        activeEquipmentIds?: readonly string[];
      }) => ({
        data: prepareDenaliServerCloneCanonical(canonicalData, { activeEquipmentIds }),
      }),
    }),
    wizardHost: deepFreeze({ ...denaliWizardHostHooks }),
  });
}

export const denaliWorkspacePlugin = Object.freeze(createDenaliWorkspacePlugin()) as ReturnType<
  typeof createDenaliWorkspacePlugin
>;

export function getDenaliWorkspacePlugin(): typeof denaliWorkspacePlugin {
  return denaliWorkspacePlugin;
}

export { denaliPluginForWizardEngine } from "./plugin-for-wizard-engine";

/** Phase 9.7 — finance command center panel manifest (Denali-only). */
export function getDenaliFinanceOpsManifest(): FinanceOpsManifest {
  return DEFAULT_FINANCE_OPS_MANIFEST;
}

/** Phase 9.5 — Registration Command Center manifest (Denali-only). */
export { getDenaliRegistrationOpsManifest };

/** Phase 9.6 — settings module registry surface (Denali-only). */
export { getDenaliOperatorSettingsSurface };

/** Phase 9.3 — operator list projection extractor (Denali-only). */
export { extractDenaliTourListProjection } from "./list/tour-list-projection";

/** Wizard UI — conditional field rules for web host (Phase 6.3 / 9). */
export {
  evaluateFormFieldRule,
  evaluateFormRules,
  type EvaluatedFormFieldRule,
  type EvaluateFormFieldRuleResult,
  type EvaluateFormRulesOptions,
} from "./rules/evaluateFormRules";
export {
  applyDenaliInvariantState,
  prepareDenaliWizardFormForSubmit,
} from "./normalize/invariantState";
export { resolveDenaliRuleSetFromTemplate } from "./normalize/resolveRuleModel";
export {
  resolveDenaliRuleSetFromOverlay,
  parseFieldRulesOverlay,
  applyOverlayToRuleSet,
  type FieldRuleOverlayPatch,
} from "./rules/templateOverlay";
export { readDenaliCanonicalBasics } from "./adapters/canonical-basics";
export {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "./schemas/denaliCore.schema";
export { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./rules/generated/denaliCanonicalPathMap.generated";
export { DENALI_TOUR_KIND_VALUES } from "./types/legacy/repo-types";
export { getDenaliFieldCompletionWeight } from "./field-registry/denaliFieldCompletionWeights";
export {
  buildDenaliFullWizardTemplatePayload,
  buildDenaliFullWizardTemplateSteps,
} from "./settings/denaliFullWizardTemplate";
export {
  prepareDenaliSubmitArtifact,
  projectDenaliWizardFormToCanonicalData,
  projectDenaliWizardFormToCanonicalIngressData,
} from "./acl/migrateDenaliCanonical";
