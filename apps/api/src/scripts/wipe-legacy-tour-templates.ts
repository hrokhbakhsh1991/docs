/**
 * Wipes legacy workspace tour presets and resets wizard templates for Denali canonical JSONB.
 *
 * Usage: ALLOW_LEGACY_TEMPLATE_WIPE=1 pnpm --filter api wipe:legacy-tour-templates
 */
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { wipeLegacyTourTemplates } from "../modules/settings-locations/wipe-legacy-tour-templates.util";
import { emitScriptInfo } from "./script-log";

async function main(): Promise<void> {
  if (process.env.ALLOW_LEGACY_TEMPLATE_WIPE !== "1") {
    console.error(
      "Refusing to wipe templates without ALLOW_LEGACY_TEMPLATE_WIPE=1 (destructive).",
    );
    process.exitCode = 1;
    return;
  }

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();
  try {
    const result = await wipeLegacyTourTemplates(dataSource);
    emitScriptInfo(JSON.stringify(result));
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
