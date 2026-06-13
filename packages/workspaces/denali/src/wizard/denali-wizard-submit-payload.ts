import { createCanonicalDocument, type CreateTourPayload, type UpdateTourPayload, type WorkspacePlugin, type WorkspaceWizardHostPluginContext } from "@app-tour/workspace-sdk";

import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  prepareDenaliSubmitArtifact,
} from "../acl/migrateDenaliCanonical";
import {
  denaliHydrateTourEditDraft,
  filterGearItemsToActiveEquipmentCatalog,
} from "../clone/denali-tour-clone-hydration";
import {
  applyDenaliTourPatchIntent,
  type DenaliTourPatchIntent,
} from "../tours/denali-tour-patch-intent";
import type { CanonicalWizardDraftEnvelope } from "./canonical-draft-access";
import {
  sanitizeGearCatalogRefsOnDraft,
  sanitizeGuideLanguageIdsOnDraft,
  sanitizeItineraryDestinationIdsOnDraft,
  sanitizeItineraryPhotoIdsOnDraft,
  sanitizeLeaderUserIdsOnDraft,
  sanitizeThemeIdsOnDraft,
} from "./denali-wizard-catalog-sanitize";
import {
  sanitizeDenaliWizardDraftEnvelope,
  sanitizeDenaliWizardDraftRecord,
} from "./denali-wizard-draft-sanitize";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import {
  buildDenaliWizardRuleEvalContext,
  type DenaliWizardRuleEvalContext,
} from "./denali-wizard-rule-eval-context";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";

export type PrepareDenaliTourCreatePayloadOptions = {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeThemeIds?: readonly string[];
  readonly activeGuideLanguageIds?: readonly string[];
  readonly selectableLeaderIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
};

export type PrepareDenaliTourPatchPayloadOptions = PrepareDenaliTourCreatePayloadOptions & {
  readonly patchIntent?: DenaliTourPatchIntent;
};

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

export function prepareDenaliTourCreatePayload(
  draft: Readonly<Record<string, unknown>>,
  plugin: WorkspacePlugin,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext,
  options?: PrepareDenaliTourCreatePayloadOptions
): CreateTourPayload {
  let envelope = sanitizeDenaliWizardDraftEnvelope(asDraftEnvelope(draft), rules, evalContext);
  envelope = sanitizeGearCatalogRefsOnDraft(
    envelope,
    options?.activeEquipmentIds,
    filterGearItemsToActiveEquipmentCatalog
  );
  envelope = sanitizeThemeIdsOnDraft(envelope, options?.activeThemeIds);
  envelope = sanitizeGuideLanguageIdsOnDraft(envelope, options?.activeGuideLanguageIds);
  envelope = sanitizeLeaderUserIdsOnDraft(envelope, options?.selectableLeaderIds);
  envelope = sanitizeItineraryPhotoIdsOnDraft(envelope);
  envelope = sanitizeItineraryDestinationIdsOnDraft(envelope, options?.activeDestinationIds);
  const form = tourWizardDraftToDenaliForm(envelope, rules) as unknown as Record<string, unknown>;
  const document = createCanonicalDocument({
    schemaVersion: DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
    roots: [...plugin.wizard.roots],
    data: prepareDenaliSubmitArtifact(form),
  });
  return {
    schemaVersion: DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
    roots: [...document.roots],
    data: document.data as Record<string, unknown>,
  };
}

export function prepareDenaliTourPatchPayload(
  draft: Readonly<Record<string, unknown>>,
  plugin: WorkspacePlugin,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext,
  rowVersion: number,
  options?: PrepareDenaliTourPatchPayloadOptions
): UpdateTourPayload {
  const { patchIntent = "save", ...catalogOptions } = options ?? {};
  const createPayload = prepareDenaliTourCreatePayload(
    draft,
    plugin,
    rules,
    evalContext,
    catalogOptions
  );
  return applyDenaliTourPatchIntent(
    {
      rowVersion,
      schemaVersion: createPayload.schemaVersion,
      roots: createPayload.roots,
      data: createPayload.data,
    },
    patchIntent
  );
}

export function prepareDenaliTourCreatePayloadFromHostInput(input: {
  readonly plugin: WorkspaceWizardHostPluginContext;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly evalContext: unknown;
  readonly catalog?: PrepareDenaliTourCreatePayloadOptions;
}): CreateTourPayload {
  const plugin = input.plugin as WorkspacePlugin;
  return prepareDenaliTourCreatePayload(
    input.draft,
    plugin,
    input.rulesModule as DenaliWizardRulesModule,
    input.evalContext as DenaliWizardRuleEvalContext,
    input.catalog
  );
}

export function sanitizeDenaliWizardDraftFromHostInput(input: {
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly evalContext: unknown;
}): Record<string, unknown> {
  return sanitizeDenaliWizardDraftRecord(
    input.draft,
    input.rulesModule as DenaliWizardRulesModule,
    input.evalContext as DenaliWizardRuleEvalContext
  );
}

export function buildDenaliWizardRuleEvalContextFromHostInput(input: {
  readonly workspaceFormProfile?: string;
  readonly mainThemeFormProfile?: string;
  readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
}): DenaliWizardRuleEvalContext {
  return buildDenaliWizardRuleEvalContext(input);
}

export function denaliHydrateTourEditDraftFromHostInput(input: {
  readonly canonicalData: Readonly<Record<string, unknown>>;
  readonly activeEquipmentIds?: readonly string[];
  readonly activeDestinationIds?: readonly string[];
}): Record<string, unknown> {
  const options =
    input.activeEquipmentIds !== undefined || input.activeDestinationIds !== undefined
      ? {
          ...(input.activeEquipmentIds !== undefined
            ? { activeEquipmentIds: input.activeEquipmentIds }
            : {}),
          ...(input.activeDestinationIds !== undefined
            ? { activeDestinationIds: input.activeDestinationIds }
            : {}),
        }
      : undefined;
  return denaliHydrateTourEditDraft(input.canonicalData as Record<string, unknown>, options).data;
}

export function prepareDenaliTourPatchPayloadFromHostInput(input: {
  readonly plugin: WorkspaceWizardHostPluginContext;
  readonly draft: Readonly<Record<string, unknown>>;
  readonly rulesModule: unknown;
  readonly evalContext: unknown;
  readonly rowVersion: number;
  readonly patchIntent?: DenaliTourPatchIntent;
  readonly catalog?: PrepareDenaliTourCreatePayloadOptions;
}): UpdateTourPayload {
  const plugin = input.plugin as WorkspacePlugin;
  return prepareDenaliTourPatchPayload(
    input.draft,
    plugin,
    input.rulesModule as DenaliWizardRulesModule,
    input.evalContext as DenaliWizardRuleEvalContext,
    input.rowVersion,
    { ...input.catalog, patchIntent: input.patchIntent }
  );
}

export {
  buildDenaliWizardRuleEvalContext,
  DENALI_DEFAULT_WORKSPACE_FORM_PROFILE,
  type DenaliWizardRuleEvalContext,
} from "./denali-wizard-rule-eval-context";
export { sanitizeDenaliWizardDraftRecord } from "./denali-wizard-draft-sanitize";
