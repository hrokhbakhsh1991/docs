import { type WorkspacePlugin } from "@app-tour/workspace-sdk";

import { denaliRegistrationOpsManifest } from "./bookings/ops-manifest";
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
import { denaliExposureSurface } from "./exposure/denali-exposure.surface";
import { denaliFieldPolicyManifest } from "./integrations/denali-field-policy.manifest";
import { denaliIntegrationSurface } from "./integrations/denali-integration.surface";
import { extractDenaliTourListProjection } from "./list/tour-list-projection";
import { denaliOperatorSettingsSurface } from "./settings/denali-settings.manifest";
import { denaliWizardHostHooks } from "./wizard/denali-wizard-host-hooks";

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
    wizardHost: deepFreeze({ ...denaliWizardHostHooks }),
    draftTombstone: denaliDraftTombstoneBinding,
  });
}

const denaliWorkspacePlugin = Object.freeze(createDenaliWorkspacePlugin()) as ReturnType<
  typeof createDenaliWorkspacePlugin
>;

export function getDenaliWorkspacePlugin(): typeof denaliWorkspacePlugin {
  return denaliWorkspacePlugin;
}
