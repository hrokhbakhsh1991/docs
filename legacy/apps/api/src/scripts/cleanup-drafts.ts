/**
 * Removes stale / debug rows from `draft_snapshots`.
 *
 * Targets:
 *   - draft_key = 'undefined'
 *   - draft_key LIKE 'debug-occ-%'
 *
 * Usage (from apps/api, uses .env):
 *   pnpm run cleanup:drafts
 *   pnpm run cleanup:drafts -- --dry-run
 */
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";

import { AppModule } from "../app.module";
import { DraftSnapshotEntity } from "../modules/draft-engine/entities/draft-snapshot.entity";
import { emitScriptInfo } from "./script-log";

const UNDEFINED_DRAFT_KEY = "undefined";
const DEBUG_OCC_PREFIX = "debug-occ-%";

const dryRun = process.argv.includes("--dry-run");

function describeDatabaseTarget(): string {
  const host = process.env.DATABASE_HOST ?? "(unset)";
  const port = process.env.DATABASE_PORT ?? "5432";
  const name = process.env.DATABASE_NAME ?? "(unset)";
  const user = process.env.DATABASE_USER ?? "(unset)";
  return `${user}@${host}:${port}/${name}`;
}

function staleDraftWhereClause(): string {
  return "(draft_key = :undefinedKey OR draft_key LIKE :debugPrefix)";
}

function staleDraftParams(): { undefinedKey: string; debugPrefix: string } {
  return { undefinedKey: UNDEFINED_DRAFT_KEY, debugPrefix: DEBUG_OCC_PREFIX };
}

async function countStaleDrafts(dataSource: DataSource): Promise<number> {
  return dataSource
    .getRepository(DraftSnapshotEntity)
    .createQueryBuilder("draft")
    .where(staleDraftWhereClause(), staleDraftParams())
    .getCount();
}

async function listStaleDraftSamples(
  dataSource: DataSource,
  limit = 25,
): Promise<Array<{ draftKey: string; workspaceId: string; userId: string; version: number }>> {
  const rows = await dataSource
    .getRepository(DraftSnapshotEntity)
    .createQueryBuilder("draft")
    .select(["draft.draftKey", "draft.workspaceId", "draft.userId", "draft.version"])
    .where(staleDraftWhereClause(), staleDraftParams())
    .orderBy("draft.updatedAt", "DESC")
    .limit(limit)
    .getMany();

  return rows.map((row) => ({
    draftKey: row.draftKey,
    workspaceId: row.workspaceId,
    userId: row.userId,
    version: row.version,
  }));
}

async function deleteStaleDrafts(dataSource: DataSource): Promise<number> {
  const result = await dataSource
    .getRepository(DraftSnapshotEntity)
    .createQueryBuilder()
    .delete()
    .where(staleDraftWhereClause(), staleDraftParams())
    .execute();

  return result.affected ?? 0;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_HOST || !process.env.DATABASE_NAME) {
    throw new Error(
      "cleanup-drafts: DATABASE_HOST and DATABASE_NAME must be set (run via pnpm run cleanup:drafts from apps/api with --env-file=.env).",
    );
  }

  emitScriptInfo("cleanup-drafts: bootstrapping Nest application context…");
  emitScriptInfo(`cleanup-drafts: database target → ${describeDatabaseTarget()}`);
  emitScriptInfo(`cleanup-drafts: mode → ${dryRun ? "DRY RUN (no deletes)" : "LIVE DELETE"}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const dataSource = app.get(DataSource);

    const countBefore = await countStaleDrafts(dataSource);
    emitScriptInfo(
      `cleanup-drafts: rows matching criteria (undefined key or debug-occ-*): ${countBefore}`,
    );

    if (countBefore > 0) {
      const samples = await listStaleDraftSamples(dataSource);
      emitScriptInfo(`cleanup-drafts: sample rows (up to ${samples.length}):`);
      for (const sample of samples) {
        emitScriptInfo(
          `  draft_key=${sample.draftKey} workspace_id=${sample.workspaceId} user_id=${sample.userId} version=${sample.version}`,
        );
      }
    }

    if (dryRun) {
      emitScriptInfo(
        `cleanup-drafts: dry run complete — would delete ${countBefore} row(s). Re-run without --dry-run to apply.`,
      );
      return;
    }

    if (countBefore === 0) {
      emitScriptInfo("cleanup-drafts: nothing to delete.");
      return;
    }

    const affected = await deleteStaleDrafts(dataSource);
    const countAfter = await countStaleDrafts(dataSource);

    emitScriptInfo(`cleanup-drafts: delete executed — affected rows: ${affected}`);
    emitScriptInfo(`cleanup-drafts: remaining matching rows: ${countAfter}`);

    if (countAfter > 0) {
      throw new Error(
        `cleanup-drafts: expected 0 stale rows after delete, found ${countAfter}.`,
      );
    }

    emitScriptInfo("cleanup-drafts: completed successfully.");
  } finally {
    try {
      await app.close();
    } catch (closeError: unknown) {
      const message =
        closeError instanceof Error ? closeError.message : String(closeError);
      emitScriptInfo(`cleanup-drafts: warning — app.close(): ${message}`);
    }
  }
}

void main().catch((error: unknown) => {
  console.error(
    "cleanup-drafts failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exit(1);
});
