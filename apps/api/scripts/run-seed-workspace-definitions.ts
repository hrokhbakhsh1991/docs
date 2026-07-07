#!/usr/bin/env node
/**
 * P3-A A4 — upsert workspace definition snapshots from scripts/seed/definitions/*.json
 *
 * Run: pnpm --filter @apps/api run seed:workspace-definitions
 */
import { logger } from "../src/observability/logger.ts";
import { seedWorkspaceDefinitionsFromDir } from "./seed-workspace-definitions.ts";

async function main(): Promise<void> {
  const seeded = await seedWorkspaceDefinitionsFromDir();
  for (const row of seeded) {
    logger.info(
      {
        event: "workspace.definition.seeded",
        definitionId: row.definitionId,
        version: row.version,
        workspaceType: row.workspaceType,
      },
      "workspace definition seeded"
    );
  }
  if (seeded.length === 0) {
    logger.info({ event: "workspace.definition.seed_skipped" }, "no definition JSON files found");
  }
}

main().catch(() => {
  logger.error(
    { event: "workspace.definition.seed_failed", code: "SEED_WORKSPACE_DEFINITIONS_FAILED" },
    "workspace definition seed failed"
  );
  process.exit(1);
});
