import { type WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  DEFAULT_BOOKING_OPS_MANIFEST,
  denaliRegistrationOpsManifest,
  resolveBookingOpsManifestFromTheme,
} from "./bookings/ops-manifest";
import { toDenaliCatalogCard } from "./catalog/denali-catalog-card";
import { denaliCatalogIntakeSurface } from "./catalog/denali-catalog-intake";
import { isDenaliTourPublished } from "./catalog/denali-publish-status";
import { denaliHydrateTourCloneDraft, prepareDenaliServerCloneCanonical } from "./clone";
import {
  DENALI_FIELD_REGISTRY,
  DENALI_LIFECYCLE,
  DENALI_RULE_SET,
  DENALI_WIZARD_SURFACE,
  denaliWorkspaceTheme,
} from "./denali-plugin-build";
import {
  DENALI_THEME_ADMIN_STYLESHEET,
  DENALI_THEME_TOKENS_STYLESHEET,
  DENALI_WORKSPACE_PLUGIN_ID,
  DENALI_WORKSPACE_TYPE,
} from "./denali-identity";
import { denaliDraftTombstoneBinding } from "./draft/denali-draft-tombstone-binding";
import {
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  denaliEditTourDraftKey,
} from "./draft/denali-wizard-draft-binding";
import { isDenaliFreshStartEnvelope, mergeDenaliWizardDraftEnvelope } from "./draft/merge-envelope";
import {
  buildDenaliCreatePrefilledForm,
  type DenaliTemplateGatePrefill,
} from "./draft/denali-create-prefill";
import { createDenaliDraftSchemaGate } from "./draft/create-denali-draft-schema-gate";
import { createDenaliWizardDraftSessionId } from "./photos/wizard-draft-session-id";
import { logDenaliTombstoneShadowMismatch } from "./draft/tombstone-shadow-log";
import { denaliExposureSurface } from "./exposure/denali-exposure.surface";
import { denaliFieldPolicyManifest } from "./integrations/denali-field-policy.manifest";
import { denaliIntegrationSurface } from "./integrations/denali-integration.surface";
import { extractDenaliTourListProjection } from "./list/tour-list-projection";
import { denaliOperatorSettingsSurface } from "./settings/denali-settings.manifest";
import { denaliWizardHostHooks } from "./wizard/denali-wizard-host-hooks";
import { ensureWizardCreateChromePackageSurface } from "./wizard/create-chrome-surface";
import { ensureWizardFlatEditChromePackageSurface } from "./wizard/flat-edit-chrome-surface";
import { ensureWizardCreateViewPackageSurface } from "./wizard/create-view-surface";
import { ensureWizardFlatEditFormPackageSurface } from "./wizard/flat-edit-form-surface";
import { ensureWizardFlatEditPagePackageSurface } from "./wizard/flat-edit-page-surface";
import { ensureOperatorUiComponentsPackageSurface } from "./wizard/operator-ui-surface";
import { ensureWizardLabelResolverPackageSurface } from "./wizard/label-resolver-surface";
import { ensureWizardSurfacesPackageSurface } from "./wizard/wizard-surfaces-surface";
import { DENALI_TOUR_KIND_STEP_ID } from "./wizard/ensure-tour-kind-template-field";
import { augmentDenaliWizardTemplateFieldOverlays } from "./wizard/denali-wizard-template-field-overlays";
import { denaliTourActionSubmitCodec } from "./wizard/tour-action-submit-codec";
import { buildDenaliFullWizardTemplatePayload } from "./settings/denaliFullWizardTemplate";
import {
  DENALI_BACKEND_REQUIRED_MODULE_IDS,
  DENALI_FALLBACK_SETTINGS_MODULES,
} from "./settings/denali-fallback-settings-modules";
import { denaliWizardTemplateEditor } from "./settings/wizard-template-editor";
import { denaliTourListCategorySurface } from "./tours/tour-list-category-surface";
import { resolveDenaliSuggestedPrepaymentMinor } from "./bookings/resolve-denali-prepayment-policy";
import { denaliDestinationSettingsSurface } from "./settings/destination-settings-surface";
import {
  DEFAULT_FINANCE_OPS_MANIFEST,
  resolveFinanceOpsManifestFromTheme,
} from "./finance/finance-ops-manifest";
import { ensureSettingsEquipmentUiPackageSurface } from "./settings/settings-equipment-ui-package-surface";
import { ensureSettingsExposureSurfacesUiPackageSurface } from "./settings/settings-exposure-surfaces-ui-package-surface";
import {
  isDraftEssentiallyEmpty,
  readDenaliDraftFieldValue,
} from "./wizard/resolve-initial-step-index";

export {
  DENALI_THEME_ADMIN_STYLESHEET,
  DENALI_THEME_TOKENS_STYLESHEET,
  DENALI_WORKSPACE_PLUGIN_ID,
  DENALI_WORKSPACE_TYPE,
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** Host contract factory — only this module’s public surface is the six-symbol allowlist. */
export function createDenaliWorkspacePlugin(): WorkspacePlugin {
  const wizardHost = deepFreeze({ ...denaliWizardHostHooks });
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
    theme: deepFreeze({ ...denaliWorkspaceTheme }),
    registrationOps: deepFreeze({
      manifestVersion: 1 as const,
      manifest: denaliRegistrationOpsManifest,
    }),
    operatorSettings: deepFreeze({ ...denaliOperatorSettingsSurface }),
    integrationSurface: deepFreeze({ ...denaliIntegrationSurface }),
    exposureSurface: deepFreeze({ ...denaliExposureSurface }),
    fieldPolicy: deepFreeze({ ...denaliFieldPolicyManifest }),
    tourList: deepFreeze({
      extractTourListProjection: extractDenaliTourListProjection,
    }),
    publicCatalog: deepFreeze({
      isPublished: isDenaliTourPublished,
      toCatalogCard: toDenaliCatalogCard,
    }),
    catalogIntake: denaliCatalogIntakeSurface,
    tourClone: deepFreeze({
      hydrateWizardDraft: ({
        canonicalData,
        activeEquipmentIds,
        activeDestinationIds,
        wizardSessionId,
        tenantId,
      }) =>
        denaliHydrateTourCloneDraft(canonicalData, {
          activeEquipmentIds,
          activeDestinationIds,
          wizardSessionId,
          tenantId,
        }),
      prepareServerCloneCreateData: ({
        canonicalData,
        activeEquipmentIds,
        activeDestinationIds,
      }: {
        canonicalData: Record<string, unknown>;
        activeEquipmentIds?: readonly string[];
        activeDestinationIds?: readonly string[];
      }) => ({
        data: prepareDenaliServerCloneCanonical(canonicalData, {
          activeEquipmentIds,
          activeDestinationIds,
        }),
      }),
    }),
    wizardHost,
    capabilities: deepFreeze({
      wizardHost,
      draftShell: deepFreeze({
        createTourDraftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
        operatorDraftNamespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
        editTourDraftKey: denaliEditTourDraftKey,
        createWizardDraftSessionId: createDenaliWizardDraftSessionId,
        isFreshStartEnvelope: (envelope: unknown) => isDenaliFreshStartEnvelope(envelope as never),
        resolveDraftMerge: (mode: string) => {
          // Mirror resolveDenaliDraftMerge without importing denali.plugin (cycle).
          if (mode === "on") {
            return undefined;
          }
          return (local: unknown, server: unknown) => {
            const merge = wizardHost.mergeDraftEnvelope;
            if (merge != null) {
              return merge(local as never, server as never);
            }
            return mergeDenaliWizardDraftEnvelope(local as never, server as never);
          };
        },
        buildCreatePrefilledForm: (gate: unknown) =>
          buildDenaliCreatePrefilledForm(gate as DenaliTemplateGatePrefill),
        createDraftSchemaGate: (rules: unknown, evalContext: unknown) =>
          createDenaliDraftSchemaGate(rules as never, evalContext as never),
        isDraftEssentiallyEmpty: (draft: unknown) =>
          isDraftEssentiallyEmpty(draft as Readonly<Record<string, unknown>>),
        readDraftFieldValue: (draft: Record<string, unknown>, canonicalPath: string) =>
          readDenaliDraftFieldValue(draft, canonicalPath),
        logTombstoneShadowMismatch: (mode, baseline, local, server) => {
          logDenaliTombstoneShadowMismatch(mode as never, baseline, local, server);
        },
      }),
      createChrome: deepFreeze({
        ensureReady: async () => {
          await ensureWizardCreateChromePackageSurface();
        },
      }),
      flatEditChrome: deepFreeze({
        ensureReady: async () => {
          await ensureWizardFlatEditChromePackageSurface();
        },
      }),
      createView: deepFreeze({
        ensureReady: async () => {
          await ensureWizardCreateViewPackageSurface();
        },
      }),
      flatEditForm: deepFreeze({
        ensureReady: async () => {
          await ensureWizardFlatEditFormPackageSurface();
        },
      }),
      flatEditPage: deepFreeze({
        ensureReady: async () => {
          await ensureWizardFlatEditPagePackageSurface();
        },
      }),
      templateGate: deepFreeze({
        defaultPublishedStepId: DENALI_TOUR_KIND_STEP_ID,
        preferTemplateDefaultsOnPrefill: true,
        augmentFieldOverlays: augmentDenaliWizardTemplateFieldOverlays,
      }),
      operatorUi: deepFreeze({
        ensureReady: async () => {
          await ensureOperatorUiComponentsPackageSurface();
        },
      }),
      tourActionSubmit: deepFreeze({
        encode: denaliTourActionSubmitCodec.encode,
        decode: denaliTourActionSubmitCodec.decode,
      }),
      labels: deepFreeze({
        ensureReady: async () => {
          await ensureWizardLabelResolverPackageSurface();
        },
      }),
      wizardSurfaces: deepFreeze({
        ensureReady: async () => {
          await ensureWizardSurfacesPackageSurface();
        },
      }),
      templatePreset: deepFreeze({
        buildFullTemplatePreset: buildDenaliFullWizardTemplatePayload,
      }),
      settingsHubFallback: deepFreeze({
        requiredModuleIds: DENALI_BACKEND_REQUIRED_MODULE_IDS,
        fallbackModules: DENALI_FALLBACK_SETTINGS_MODULES,
      }),
      templateEditor: denaliWizardTemplateEditor,
      tourListCategory: denaliTourListCategorySurface,
      tourCommercial: deepFreeze({
        resolveSuggestedPrepaymentMinor: resolveDenaliSuggestedPrepaymentMinor,
      }),
      settingsDestination: denaliDestinationSettingsSurface,
      settingsEquipmentUi: deepFreeze({
        ensureReady: async () => {
          await ensureSettingsEquipmentUiPackageSurface();
        },
      }),
      settingsExposureSurfacesUi: deepFreeze({
        ensureReady: async () => {
          await ensureSettingsExposureSurfacesUiPackageSurface();
        },
      }),
      financeNav: deepFreeze({ supported: true as const }),
      walletNav: deepFreeze({ supported: true as const }),
      financeCaseMeaning: deepFreeze({ supported: true as const }),
      financeOps: deepFreeze({
        resolveManifest: (theme: unknown = null) =>
          theme === null || theme === undefined
            ? DEFAULT_FINANCE_OPS_MANIFEST
            : resolveFinanceOpsManifestFromTheme(theme),
      }),
      bookingOps: deepFreeze({
        resolveManifest: (theme: unknown = null) =>
          theme === null || theme === undefined
            ? DEFAULT_BOOKING_OPS_MANIFEST
            : resolveBookingOpsManifestFromTheme(theme),
      }),
      wizardCreate: deepFreeze({
        extendedChrome: true as const,
      }),
    }),
    draftTombstone: denaliDraftTombstoneBinding,
  });
}

const denaliWorkspacePlugin = Object.freeze(createDenaliWorkspacePlugin()) as ReturnType<
  typeof createDenaliWorkspacePlugin
>;

export function getDenaliWorkspacePlugin(): typeof denaliWorkspacePlugin {
  return denaliWorkspacePlugin;
}

/** Canonical host-contract getter (manifest plugin/web.export; Phase 4m). */
export function getWorkspacePlugin(): typeof denaliWorkspacePlugin {
  return getDenaliWorkspacePlugin();
}
