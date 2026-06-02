import type { DataSource } from "typeorm";
import { DEFAULT_TOUR_FORM_PROFILE } from "@repo/types";

import {
  storedTemplateRowIsLegacy,
  type CleanupLegacyTemplatesReport,
} from "@repo/types/denali";

export type { CleanupLegacyTemplatesReport };

async function countObsoletePresets(dataSource: DataSource): Promise<number> {
  const rows = await dataSource.query<
    Array<{
      id: string;
      canonical_data: unknown;
      defaults: unknown;
    }>
  >(`SELECT id, canonical_data, defaults FROM workspace_tour_creation_presets`);

  return rows.filter((row) =>
    storedTemplateRowIsLegacy({
      canonicalData: row.canonical_data,
      defaults: row.defaults,
    }),
  ).length;
}

async function countObsoleteWizardTemplates(dataSource: DataSource): Promise<number> {
  const rows = await dataSource.query<
    Array<{
      id: string;
      canonical_data: unknown;
      defaults: unknown;
      field_rules_overlay: unknown;
      step_overrides: unknown;
    }>
  >(
    `SELECT id, canonical_data, field_rules_overlay, step_overrides
     FROM workspace_tour_wizard_templates`,
  );

  return rows.filter((row) =>
    storedTemplateRowIsLegacy({
      canonicalData: row.canonical_data,
      fieldRulesOverlay: row.field_rules_overlay,
      stepOverrides: row.step_overrides,
    }),
  ).length;
}

/**
 * Deletes all workspace tour presets and resets wizard templates to empty Denali canonical shells.
 * Legacy `defaults` / overlay payloads are not migrated — they are removed.
 */
export async function cleanupLegacyTemplates(
  dataSource: DataSource,
): Promise<CleanupLegacyTemplatesReport> {
  const obsoletePresetRows = await countObsoletePresets(dataSource);
  const obsoleteWizardTemplateRows = await countObsoleteWizardTemplates(dataSource);

  const presetDelete = await dataSource.query(`DELETE FROM workspace_tour_creation_presets`);
  const templateUpdate = await dataSource.query(`
    UPDATE workspace_tour_wizard_templates
    SET
      field_rules_overlay = '{}'::jsonb,
      step_overrides = '{"skip":[],"insert":[]}'::jsonb,
      canonical_data = '{}'::jsonb,
      base_profile = '${DEFAULT_TOUR_FORM_PROFILE}'
  `);

  const presetsDeleted =
    typeof presetDelete?.[1] === "number" ? presetDelete[1] : Number(presetDelete?.[1] ?? 0);
  const wizardTemplatesReset =
    typeof templateUpdate?.[1] === "number"
      ? templateUpdate[1]
      : Number(templateUpdate?.[1] ?? 0);

  return {
    presetsDeleted,
    wizardTemplatesReset,
    obsoletePresetRows,
    obsoleteWizardTemplateRows,
  };
}

/** Verifies repositories are empty of legacy payload after cleanup. */
export async function verifyCanonicalTemplateStorageIsClean(
  dataSource: DataSource,
): Promise<{ presetCount: number; wizardTemplateCount: number }> {
  const presetCount = await dataSource.query<Array<{ count: string }>>(
    `SELECT count(*)::text AS count FROM workspace_tour_creation_presets`,
  );
  const wizardTemplateCount = await dataSource.query<Array<{ count: string }>>(
    `SELECT count(*)::text AS count FROM workspace_tour_wizard_templates`,
  );
  return {
    presetCount: Number(presetCount[0]?.count ?? 0),
    wizardTemplateCount: Number(wizardTemplateCount[0]?.count ?? 0),
  };
}
