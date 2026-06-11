import { createCanonicalDocument } from "@app-tour/workspace-sdk";
import {
  DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
  filterGearItemsToActiveEquipmentCatalog,
  prepareDenaliSubmitArtifact,
} from "@app-tour/workspace-denali";
import type { CreateTourPayload, WorkspacePlugin } from "@app-tour/workspace-sdk";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import {
  sanitizeLeaderUserIdsOnDraft,
  sanitizeThemeIdsOnDraft,
} from "./denali-catalog-sanitize";
import {
  sanitizeDenaliWizardDraft,
  tourWizardDraftToDenaliForm,
} from "./denali-draft-form-adapter";
import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";

export type PrepareDenaliTourCreatePayloadOptions = {
  readonly activeEquipmentIds?: readonly string[];
  readonly activeThemeIds?: readonly string[];
  readonly selectableLeaderIds?: readonly string[];
};

function sanitizeGearCatalogRefs(
  draft: TourWizardDraft,
  activeEquipmentIds: readonly string[] | undefined
): TourWizardDraft {
  if (activeEquipmentIds === undefined) {
    return draft;
  }
  const raw = getCanonicalValue(draft, "participants.gearItems");
  if (!Array.isArray(raw)) {
    return draft;
  }
  const filtered = filterGearItemsToActiveEquipmentCatalog(raw, activeEquipmentIds);
  return setCanonicalValue(draft, "participants.gearItems", filtered);
}

/**
 * Final Denali create payload — invariant sanitize, optional gear catalog filter,
 * then canonical document projection (roots + schemaVersion from workspace plugin).
 */
export function prepareDenaliTourCreatePayload(
  draft: TourWizardDraft,
  plugin: WorkspacePlugin,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext,
  options?: PrepareDenaliTourCreatePayloadOptions
): CreateTourPayload {
  let next = sanitizeDenaliWizardDraft(draft, rules, evalContext);
  next = sanitizeGearCatalogRefs(next, options?.activeEquipmentIds);
  next = sanitizeThemeIdsOnDraft(next, options?.activeThemeIds);
  next = sanitizeLeaderUserIdsOnDraft(next, options?.selectableLeaderIds);
  const form = tourWizardDraftToDenaliForm(next, rules) as Record<string, unknown>;
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
