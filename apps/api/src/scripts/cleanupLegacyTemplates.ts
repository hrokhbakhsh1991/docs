/**
 * Wipes legacy workspace tour templates/presets and verifies canonical-only storage.
 *
 * Usage: ALLOW_LEGACY_TEMPLATE_WIPE=1 pnpm --filter api cleanup:legacy-templates
 */
import { DataSource } from "typeorm";

import { TEMPLATE_SCHEMA_ALIGNED_WITH_CANONICAL_MODEL } from "@repo/types/denali";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import {
  cleanupLegacyTemplates,
  verifyCanonicalTemplateStorageIsClean,
} from "../modules/settings-locations/cleanup-legacy-templates.util";
import { emitScriptInfo } from "./script-log";

async function main(): Promise<void> {
  if (process.env.ALLOW_LEGACY_TEMPLATE_WIPE !== "1") {
    console.error(
      "Refusing to run without ALLOW_LEGACY_TEMPLATE_WIPE=1 (deletes all tour creation presets).",
    );
    process.exitCode = 1;
    return;
  }

  if (!TEMPLATE_SCHEMA_ALIGNED_WITH_CANONICAL_MODEL) {
    throw new Error("Denali template schema is not aligned with DenaliCanonicalTourModel");
  }

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    const report = await cleanupLegacyTemplates(dataSource);
    emitScriptInfo(`cleanup report: ${JSON.stringify(report)}`);

    const verification = await verifyCanonicalTemplateStorageIsClean(dataSource);
    emitScriptInfo(`post-cleanup: ${JSON.stringify(verification)}`);

    if (report.presetsDeleted > 0 && verification.presetCount !== 0) {
      throw new Error(
        `Expected preset table empty after cleanup, found ${verification.presetCount}`,
      );
    }

    const legacyCanonical = await dataSource.query<
      Array<{ id: string; canonical_data: unknown; defaults: unknown }>
    >(`SELECT id, canonical_data, defaults FROM workspace_tour_creation_presets LIMIT 5`);
    if (legacyCanonical.length > 0) {
      throw new Error("Preset rows remain after cleanup");
    }

    emitScriptInfo("Template storage is canonical-schema driven (DenaliCanonicalTourModel).");
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
