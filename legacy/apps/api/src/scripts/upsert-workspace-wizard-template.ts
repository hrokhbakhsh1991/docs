import type { DataSource } from "typeorm";

import type { TourFormProfile } from "@repo/types";

import { emitScriptInfo } from "./script-log";

export type WorkspaceWizardTemplateUpsert = {
  baseProfile?: TourFormProfile;
  stepOverrides?: { skip: string[]; insert: string[] };
  fieldRulesOverlay?: Record<string, unknown>;
  wizardContractVersion?: number;
  formProfileVersion?: number;
};

export async function upsertWorkspaceWizardTemplate(
  ds: DataSource,
  workspaceId: string,
  opts: WorkspaceWizardTemplateUpsert = {},
): Promise<void> {
  const baseProfile = opts.baseProfile ?? "general";
  const stepOverrides = JSON.stringify(opts.stepOverrides ?? { skip: [], insert: [] });
  const fieldRulesOverlay = JSON.stringify(opts.fieldRulesOverlay ?? {});
  const wizardContractVersion = opts.wizardContractVersion ?? 1;
  const formProfileVersion = opts.formProfileVersion ?? 1;

  await ds.query(
    `INSERT INTO workspace_tour_wizard_templates
      (workspace_id, base_profile, step_overrides, field_rules_overlay, wizard_contract_version, form_profile_version)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
     ON CONFLICT (workspace_id) DO UPDATE SET
       base_profile = EXCLUDED.base_profile,
       step_overrides = EXCLUDED.step_overrides,
       field_rules_overlay = EXCLUDED.field_rules_overlay,
       wizard_contract_version = EXCLUDED.wizard_contract_version,
       form_profile_version = EXCLUDED.form_profile_version,
       updated_at = now()`,
    [
      workspaceId,
      baseProfile,
      stepOverrides,
      fieldRulesOverlay,
      wizardContractVersion,
      formProfileVersion,
    ],
  );
  emitScriptInfo(
    `Upserted workspace tour wizard template (baseProfile=${baseProfile}) for workspace ${workspaceId}`,
  );
}
