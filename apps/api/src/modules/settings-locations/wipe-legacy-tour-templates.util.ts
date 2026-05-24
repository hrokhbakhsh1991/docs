import type { DataSource } from "typeorm";

import {
  cleanupLegacyTemplates,
  type CleanupLegacyTemplatesReport,
} from "./cleanup-legacy-templates.util";

export type WipeLegacyTourTemplatesResult = {
  deletedPresets: number;
  updatedWizardTemplates: number;
};

/** @deprecated Use {@link cleanupLegacyTemplates}. */
export async function wipeLegacyTourTemplates(
  dataSource: DataSource,
): Promise<WipeLegacyTourTemplatesResult> {
  const report: CleanupLegacyTemplatesReport = await cleanupLegacyTemplates(dataSource);
  return {
    deletedPresets: report.presetsDeleted,
    updatedWizardTemplates: report.wizardTemplatesReset,
  };
}
