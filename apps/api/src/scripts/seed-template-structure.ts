/**
 * Seeds workspace tour wizard template `canonical_data` with the nested RHF reference
 * payload (`reference-template-structure.json`) validated against `denaliTourCreateBaseSchema`.
 *
 * Usage:
 *   pnpm --filter @apps/api seed:template-structure
 *   pnpm --filter @apps/api seed:template-structure -- --apply
 *   pnpm --filter @apps/api seed:template-structure -- --apply --template-id=<uuid>
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { denaliTourCreateBaseSchema, type DenaliCreateTourWizardForm } from "@repo/denali-domain";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

const DEFAULT_TEMPLATE_IDS = [
  "4931f36a-19ed-4cd1-9ec3-eb5d12eaf7f6",
  "768660fa-47b2-45bf-8c9b-50da3cf4b5fa",
  "5ee26021-cf4b-4944-8240-9cea31d190b4",
] as const;

type TemplateRow = {
  id: string;
  workspace_id: string;
  canonical_data: unknown;
};

function loadReferencePayload(): DenaliCreateTourWizardForm {
  const jsonPath = resolve(__dirname, "reference-template-structure.json");
  if (!existsSync(jsonPath)) {
    throw new Error(`Reference payload not found: ${jsonPath}`);
  }
  const raw = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  return denaliTourCreateBaseSchema.parse(raw);
}

/** DB JSON shape — keeps audit-visible optional keys that Zod would strip on parse. */
function toStoragePayload(form: DenaliCreateTourWizardForm): Record<string, unknown> {
  const payload = JSON.parse(JSON.stringify(form)) as Record<string, unknown>;
  const basicInfo = payload.basicInfo as Record<string, unknown>;
  if (basicInfo.endDateTime === undefined) {
    basicInfo.endDateTime = "";
  }
  return payload;
}

function parseArgs(argv: string[]): { dryRun: boolean; templateIds: string[] } {
  const apply = argv.includes("--apply");
  const templateIdArg = argv.find((arg) => arg.startsWith("--template-id="));
  const templateIds =
    templateIdArg != null
      ? [templateIdArg.slice("--template-id=".length).trim()]
      : [...DEFAULT_TEMPLATE_IDS];
  if (templateIds.some((id) => id.length === 0)) {
    throw new Error("Invalid --template-id= value");
  }
  return { dryRun: !apply, templateIds };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function main(): Promise<void> {
  const { dryRun, templateIds } = parseArgs(process.argv.slice(2));
  const reference = loadReferencePayload();
  const storagePayload = toStoragePayload(reference);

  emitScriptInfo(
    `seed-template-structure: dryRun=${dryRun} templates=${templateIds.join(", ")}`,
  );

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    const rows = await dataSource.query<TemplateRow[]>(
      `SELECT id, workspace_id, canonical_data
       FROM workspace_tour_wizard_templates
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [templateIds],
    );

    const foundIds = new Set(rows.map((row) => row.id));
    for (const id of templateIds) {
      if (!foundIds.has(id)) {
        throw new Error(`Template row not found: ${id}`);
      }
    }

    let updated = 0;
    for (const row of rows) {
      const before = row.canonical_data;
      const changed = stableJson(before) !== stableJson(storagePayload);
      emitScriptInfo(
        JSON.stringify({
          id: row.id,
          workspaceId: row.workspace_id,
          dryRun,
          changed,
          beforeKeyCount: isPlainObject(before) ? Object.keys(before).length : 0,
          afterKeyCount: Object.keys(storagePayload).length,
        }),
      );

      if (!changed) {
        continue;
      }

      if (!dryRun) {
        await dataSource.query(
          `UPDATE workspace_tour_wizard_templates
           SET canonical_data = $2::jsonb, updated_at = NOW()
           WHERE id = $1`,
          [row.id, JSON.stringify(storagePayload)],
        );
      }
      updated += 1;
    }

    emitScriptInfo(
      `seed-template-structure: scanned=${rows.length} updated=${updated} dryRun=${dryRun}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`seed-template-structure failed: ${message}`);
  process.exit(1);
});
