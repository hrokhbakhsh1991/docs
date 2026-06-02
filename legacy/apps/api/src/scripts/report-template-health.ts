/**
 * Read-only workspace tour wizard template readiness report.
 *
 * Scans every row in workspace_tour_wizard_templates and classifies canonical seed
 * health for wizard load / POST instantiate (empty gate, minimal keys, hydration).
 *
 * Usage:
 *   pnpm --filter @apps/api report:template-health
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import {
  resetWizardToRegistryDefaults,
  tryHydrateCanonicalTemplate,
} from "@repo/denali-domain";
import { isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";

import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { resolveStoredTemplateCanonical } from "../modules/settings-locations/resolve-stored-template-canonical";
import { emitScriptInfo } from "./script-log";

type TemplateRow = {
  id: string;
  workspace_id: string;
  base_profile: string;
  canonical_data: unknown;
  field_rules_overlay: unknown;
  step_overrides: unknown;
  created_at: Date | string;
  updated_at: Date | string;
};

type TemplateHealthStatus =
  | "EMPTY"
  | "PARTIAL"
  | "CORRUPT"
  | "HYDRATION_EMPTY"
  | "READY";

type TemplateHealthRow = {
  id: string;
  workspaceId: string;
  title: string;
  isEmpty: boolean;
  hasMinimalKeys: boolean;
  status: TemplateHealthStatus;
  autoSeedEligible: boolean;
  missingMinimalHints: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function formatTimestamp(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function readDisplayTitle(canonical: unknown): string {
  if (!isPlainObject(canonical)) {
    return "(invalid canonical)";
  }
  const raw = canonical.title;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim().length > 40 ? `${raw.trim().slice(0, 37)}…` : raw.trim();
  }
  return "(no title)";
}

/**
 * Minimal keys for wizard UX: title AND (category+duration OR program seed).
 * Matches product guidance for a usable workspace template defaults row.
 */
function hasMinimalRequiredKeys(canonical: unknown): { ok: boolean; missing: string[] } {
  if (!isPlainObject(canonical)) {
    return { ok: false, missing: ["canonical object"] };
  }

  const missing: string[] = [];
  const hasTitle = typeof canonical.title === "string" && canonical.title.trim().length > 0;
  if (!hasTitle) {
    missing.push("title");
  }

  const hasClassification =
    canonical.category !== undefined && canonical.duration !== undefined;
  const hasProgram = canonical.program !== undefined;

  if (!hasClassification && !hasProgram) {
    missing.push("category+duration or program");
  }

  return { ok: missing.length === 0, missing };
}

function isHydratableCanonical(canonical: Record<string, unknown>): boolean {
  const defaults = resetWizardToRegistryDefaults();
  return tryHydrateCanonicalTemplate(canonical, defaults) != null;
}

function deriveStatus(input: {
  isEmpty: boolean;
  hasMinimalKeys: boolean;
  canonicalResolvable: boolean;
  hydratable: boolean;
}): TemplateHealthStatus {
  if (input.isEmpty) {
    return "EMPTY";
  }
  if (!input.canonicalResolvable) {
    return "CORRUPT";
  }
  if (!input.hasMinimalKeys) {
    return "PARTIAL";
  }
  if (!input.hydratable) {
    return "HYDRATION_EMPTY";
  }
  return "READY";
}

function auditTemplateRow(row: TemplateRow): TemplateHealthRow {
  const isEmpty = isDenaliCanonicalTemplateDataEmpty(row.canonical_data);
  const minimal = hasMinimalRequiredKeys(row.canonical_data);

  const resolved = resolveStoredTemplateCanonical({
    canonicalData: row.canonical_data,
    fieldRulesOverlay: row.field_rules_overlay,
    stepOverrides: row.step_overrides,
  });

  const canonicalResolvable = resolved.ok;
  const hydratable =
    resolved.ok && isHydratableCanonical(resolved.canonicalData as Record<string, unknown>);

  const createdAt = formatTimestamp(row.created_at);
  const updatedAt = formatTimestamp(row.updated_at);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: readDisplayTitle(row.canonical_data),
    isEmpty,
    hasMinimalKeys: minimal.ok,
    status: deriveStatus({
      isEmpty,
      hasMinimalKeys: minimal.ok,
      canonicalResolvable,
      hydratable,
    }),
    autoSeedEligible: isEmpty && createdAt === updatedAt,
    missingMinimalHints: minimal.missing.join(", ") || "—",
  };
}

function padEnd(value: string, width: number): string {
  if (value.length >= width) {
    return value.slice(0, width - 1) + "…";
  }
  return value.padEnd(width);
}

function printTable(rows: TemplateHealthRow[]): void {
  const columns = [
    { header: "ID", width: 38 },
    { header: "Title", width: 30 },
    { header: "Is_Empty", width: 10 },
    { header: "Has_Minimal_Keys", width: 18 },
    { header: "Status", width: 18 },
  ] as const;

  const headerLine = columns.map((col) => padEnd(col.header, col.width)).join(" | ");
  const ruleLine = columns.map((col) => "-".repeat(col.width)).join("-+-");

  emitScriptInfo(headerLine);
  emitScriptInfo(ruleLine);

  for (const row of rows) {
    const line = [
      padEnd(row.id, columns[0].width),
      padEnd(row.title, columns[1].width),
      padEnd(row.isEmpty ? "true" : "false", columns[2].width),
      padEnd(row.hasMinimalKeys ? "true" : "false", columns[3].width),
      padEnd(row.status, columns[4].width),
    ].join(" | ");
    emitScriptInfo(line);
  }
}

function printSummary(rows: TemplateHealthRow[]): void {
  const total = rows.length;
  const empty = rows.filter((row) => row.status === "EMPTY").length;
  const partial = rows.filter((row) => row.status === "PARTIAL").length;
  const corrupt = rows.filter((row) => row.status === "CORRUPT").length;
  const hydrationEmpty = rows.filter((row) => row.status === "HYDRATION_EMPTY").length;
  const ready = rows.filter((row) => row.status === "READY").length;

  emitScriptInfo("");
  emitScriptInfo("=== Template readiness summary ===");
  emitScriptInfo(`Total templates found:        ${total}`);
  emitScriptInfo(`Completely empty ({}):        ${empty}`);
  emitScriptInfo(`Partially configured:         ${partial}`);
  emitScriptInfo(`Canonical corrupt (Zod/fossil): ${corrupt}`);
  emitScriptInfo(`Hydration would fail:         ${hydrationEmpty}`);
  emitScriptInfo(`Ready to go (hydratable):     ${ready}`);
  emitScriptInfo("");
  emitScriptInfo(
    "Status legend: EMPTY = no top-level canonical keys; PARTIAL = missing title and/or (category+duration|program); " +
      "CORRUPT = resolveStoredTemplateCanonical failed; HYDRATION_EMPTY = passes empty gate but tryHydrate returns null; " +
      "READY = instantiate path should succeed.",
  );

  const blocked = rows.filter((row) => row.status !== "READY");
  if (blocked.length > 0) {
    emitScriptInfo("");
    emitScriptInfo("Blocked templates (detail):");
    for (const row of blocked) {
      emitScriptInfo(
        `  ${row.id} workspace=${row.workspaceId} status=${row.status} missing=${row.missingMinimalHints} autoSeedEligible=${row.autoSeedEligible}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    const dbRows = await dataSource.query<TemplateRow[]>(
      `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides, created_at, updated_at
       FROM workspace_tour_wizard_templates
       ORDER BY workspace_id, id`,
    );

    const healthRows = dbRows.map(auditTemplateRow);

    emitScriptInfo(`Workspace tour wizard template health (${healthRows.length} row(s))`);
    emitScriptInfo("");
    printTable(healthRows);
    printSummary(healthRows);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
