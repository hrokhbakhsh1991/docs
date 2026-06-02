/**
 * Selective migration: normalize workspace tour wizard template canonical_data JSONB.
 *
 * - Applies templateToCanonical (top-level strip) + validateDenaliCanonicalTemplateData (Layer A Zod).
 * - Updates rows only when valid and changed.
 * - Invalid rows are quarantined (never wiped).
 *
 * Usage:
 *   pnpm --filter @apps/api migrate:template-canonical
 *   pnpm --filter @apps/api migrate:template-canonical -- --apply
 *
 * Default is dry-run (no UPDATE). Requires apps/api/.env for DATABASE_*.
 */
import fs from "node:fs";
import path from "node:path";

import { templateToCanonical } from "@repo/types/denali";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { resolveStoredTemplateCanonical } from "../modules/settings-locations/resolve-stored-template-canonical";
import { emitScriptInfo } from "./script-log";

type TemplateRow = {
  id: string;
  workspace_id: string;
  canonical_data: unknown;
  field_rules_overlay: unknown;
  step_overrides: unknown;
};

type QuarantineEntry = {
  id: string;
  workspaceId: string;
  before: unknown;
  sanitizedAttempt: unknown;
  issues: readonly { path: string; message: string }[];
};

type MigrationReport = {
  generatedAt: string;
  dryRun: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  quarantined: number;
  rows: QuarantineEntry[];
};

function parseArgs(argv: string[]): { dryRun: boolean } {
  const apply = argv.includes("--apply");
  return { dryRun: !apply };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function resolveQuarantinePath(): string {
  const scriptDir = __dirname;
  const base = path.join(scriptDir, "quarantine.json");
  if (!fs.existsSync(base)) {
    return base;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(scriptDir, `quarantine-${stamp}.json`);
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  emitScriptInfo(`migrate-template-canonical-data: dryRun=${dryRun}`);

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  const quarantine: QuarantineEntry[] = [];
  let updated = 0;
  let unchanged = 0;

  try {
    const rows = await dataSource.query<TemplateRow[]>(
      `SELECT id, workspace_id, canonical_data, field_rules_overlay, step_overrides
       FROM workspace_tour_wizard_templates
       ORDER BY workspace_id, id`,
    );

    for (const row of rows) {
      const before = row.canonical_data;
      const storedRow = {
        canonicalData: row.canonical_data,
        fieldRulesOverlay: row.field_rules_overlay,
        stepOverrides: row.step_overrides,
      };
      const sanitizedAttempt = templateToCanonical(storedRow);
      const resolved = resolveStoredTemplateCanonical(storedRow);

      if (!resolved.ok) {
        quarantine.push({
          id: row.id,
          workspaceId: row.workspace_id,
          before,
          sanitizedAttempt,
          issues: resolved.issues,
        });
        emitScriptInfo(
          JSON.stringify({
            id: row.id,
            workspaceId: row.workspace_id,
            dryRun,
            status: "quarantined",
            before,
            sanitizedAttempt,
            issues: resolved.issues,
          }),
        );
        continue;
      }

      const after = resolved.canonicalData;
      const changed = !jsonEqual(before, after);

      emitScriptInfo(
        JSON.stringify({
          id: row.id,
          workspaceId: row.workspace_id,
          dryRun,
          status: changed ? "would_update" : "unchanged",
          before,
          after,
          changed,
        }),
      );

      if (!changed) {
        unchanged += 1;
        continue;
      }

      if (dryRun) {
        updated += 1;
        continue;
      }

      await dataSource.query(
        `UPDATE workspace_tour_wizard_templates
         SET canonical_data = $1::jsonb, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(after), row.id],
      );
      updated += 1;
    }

    const report: MigrationReport = {
      generatedAt: new Date().toISOString(),
      dryRun,
      scanned: rows.length,
      updated,
      unchanged,
      quarantined: quarantine.length,
      rows: quarantine,
    };

    if (quarantine.length > 0) {
      const quarantinePath = resolveQuarantinePath();
      fs.writeFileSync(quarantinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      emitScriptInfo(`quarantine written: ${quarantinePath} (${quarantine.length} row(s))`);
    }

    emitScriptInfo(JSON.stringify({ ...report, rows: quarantine.length > 0 ? "[see quarantine file]" : [] }, null, 2));
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
