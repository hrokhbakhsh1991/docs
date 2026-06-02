/**
 * Read-only audit: scan workspace_tour_wizard_templates.canonical_data for zombie/fossil JSON.
 *
 * - Runs resolveStoredTemplateCanonical on every row (same as GET + POST instantiate).
 * - Aggregates Zod issue paths and strip/drift paths into a corruption heatmap.
 * - Never writes to the database.
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-canonical-integrity
 *   pnpm --filter @apps/api audit:template-canonical-integrity -- --json-out=./reports/canonical-audit.json
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import fs from "node:fs";
import path from "node:path";

import {
  collectDiscardedTemplateKeys,
  type DenaliCanonicalTemplateValidationIssue,
} from "@repo/types/denali";
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
  updated_at: string;
};

type RowStatus = "valid_unchanged" | "valid_strip_drift" | "invalid";

type RowAudit = {
  id: string;
  workspaceId: string;
  baseProfile: string;
  updatedAt: string;
  status: RowStatus;
  issuePaths: string[];
  zodIssues: readonly DenaliCanonicalTemplateValidationIssue[];
  discardedTopLevelKeys: string[];
  deepDiffPaths: string[];
};

type HeatmapBucket = {
  issuePath: string;
  count: number;
  zodFailures: number;
  topLevelFossils: number;
  deepDrift: number;
  rowIds: string[];
};

type IntegrityReport = {
  generatedAt: string;
  scanned: number;
  validUnchanged: number;
  validStripDrift: number;
  invalid: number;
  top5IssuePaths: Array<{ issuePath: string; count: number; breakdown: Omit<HeatmapBucket, "issuePath" | "rowIds"> }>;
  heatmap: HeatmapBucket[];
  highRisk: {
    getWorksInstantiateFailsCanonical: {
      count: number;
      explanation: string;
      rowIds: string[];
    };
    hardCorruptBothEndpointsFail: {
      count: number;
      rowIds: string[];
      byWorkspace: Array<{ workspaceId: string; templateId: string; issuePaths: string[] }>;
    };
    softZombieDbDriftHealedAtRuntime: {
      count: number;
      rowIds: string[];
      byWorkspace: Array<{ workspaceId: string; templateId: string; driftPaths: string[] }>;
    };
  };
  rows: RowAudit[];
};

function parseArgs(argv: string[]): { jsonOut: string | null } {
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Collect dot-paths where resolved canonical output differs from raw JSONB. */
function collectDeepDiffPaths(stored: unknown, resolved: unknown, prefix = ""): string[] {
  if (jsonEqual(stored, resolved)) {
    return [];
  }

  if (Array.isArray(stored) && Array.isArray(resolved)) {
    const paths: string[] = [];
    const maxLen = Math.max(stored.length, resolved.length);
    for (let index = 0; index < maxLen; index += 1) {
      const segment = prefix ? `${prefix}[${index}]` : `[${index}]`;
      paths.push(...collectDeepDiffPaths(stored[index], resolved[index], segment));
    }
    if (stored.length !== resolved.length) {
      paths.push(prefix || "<root>");
    }
    return uniquePaths(paths);
  }

  if (isPlainObject(stored) && isPlainObject(resolved)) {
    const paths: string[] = [];
    const keys = new Set([...Object.keys(stored), ...Object.keys(resolved)]);
    for (const key of keys) {
      const segment = prefix ? `${prefix}.${key}` : key;
      if (!(key in stored) || !(key in resolved)) {
        paths.push(segment);
        continue;
      }
      paths.push(...collectDeepDiffPaths(stored[key], resolved[key], segment));
    }
    return uniquePaths(paths);
  }

  return [prefix || "<root>"];
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function bumpHeatmap(
  map: Map<string, HeatmapBucket>,
  issuePath: string,
  rowId: string,
  kind: "zodFailures" | "topLevelFossils" | "deepDrift",
): void {
  const existing = map.get(issuePath) ?? {
    issuePath,
    count: 0,
    zodFailures: 0,
    topLevelFossils: 0,
    deepDrift: 0,
    rowIds: [],
  };
  existing.count += 1;
  existing[kind] += 1;
  if (!existing.rowIds.includes(rowId)) {
    existing.rowIds.push(rowId);
  }
  map.set(issuePath, existing);
}

function auditRow(row: TemplateRow): RowAudit {
  const storedRow = {
    canonicalData: row.canonical_data,
    fieldRulesOverlay: row.field_rules_overlay,
    stepOverrides: row.step_overrides,
  };
  const resolved = resolveStoredTemplateCanonical(storedRow);
  const discardedTopLevelKeys = collectDiscardedTemplateKeys(row.canonical_data);

  if (!resolved.ok) {
    const issuePaths = uniquePaths(resolved.issues.map((issue) => issue.path));
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      baseProfile: row.base_profile,
      updatedAt: row.updated_at,
      status: "invalid",
      issuePaths,
      zodIssues: resolved.issues,
      discardedTopLevelKeys,
      deepDiffPaths: [],
    };
  }

  const resolvedCanonical = resolved.canonicalData;
  const unchanged = jsonEqual(row.canonical_data, resolvedCanonical);
  const deepDiffPaths = unchanged
    ? []
    : collectDeepDiffPaths(row.canonical_data, resolvedCanonical);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    baseProfile: row.base_profile,
    updatedAt: row.updated_at,
    status: unchanged ? "valid_unchanged" : "valid_strip_drift",
    issuePaths: uniquePaths([...discardedTopLevelKeys, ...deepDiffPaths]),
    zodIssues: [],
    discardedTopLevelKeys,
    deepDiffPaths,
  };
}

function buildReport(rows: RowAudit[]): IntegrityReport {
  const heatmapMap = new Map<string, HeatmapBucket>();

  for (const row of rows) {
    for (const issue of row.zodIssues) {
      bumpHeatmap(heatmapMap, issue.path, row.id, "zodFailures");
    }
    for (const key of row.discardedTopLevelKeys) {
      bumpHeatmap(heatmapMap, key, row.id, "topLevelFossils");
    }
    for (const driftPath of row.deepDiffPaths) {
      if (!row.discardedTopLevelKeys.includes(driftPath)) {
        bumpHeatmap(heatmapMap, driftPath, row.id, "deepDrift");
      }
    }
  }

  const heatmap = [...heatmapMap.values()].sort((a, b) => b.count - a.count || a.issuePath.localeCompare(b.issuePath));
  const top5IssuePaths = heatmap.slice(0, 5).map(({ issuePath, count, zodFailures, topLevelFossils, deepDrift }) => ({
    issuePath,
    count,
    breakdown: { count, zodFailures, topLevelFossils, deepDrift },
  }));

  const invalidRows = rows.filter((row) => row.status === "invalid");
  const stripDriftRows = rows.filter((row) => row.status === "valid_strip_drift");

  return {
    generatedAt: new Date().toISOString(),
    scanned: rows.length,
    validUnchanged: rows.filter((row) => row.status === "valid_unchanged").length,
    validStripDrift: stripDriftRows.length,
    invalid: invalidRows.length,
    top5IssuePaths,
    heatmap,
    highRisk: {
      getWorksInstantiateFailsCanonical: {
        count: 0,
        explanation:
          "GET and POST instantiate both call resolveStoredTemplateCanonical; no row can pass GET canonical validation and fail instantiate canonical validation.",
        rowIds: [],
      },
      hardCorruptBothEndpointsFail: {
        count: invalidRows.length,
        rowIds: invalidRows.map((row) => row.id),
        byWorkspace: invalidRows.map((row) => ({
          workspaceId: row.workspaceId,
          templateId: row.id,
          issuePaths: row.issuePaths,
        })),
      },
      softZombieDbDriftHealedAtRuntime: {
        count: stripDriftRows.length,
        rowIds: stripDriftRows.map((row) => row.id),
        byWorkspace: stripDriftRows.map((row) => ({
          workspaceId: row.workspaceId,
          templateId: row.id,
          driftPaths: row.issuePaths,
        })),
      },
    },
    rows,
  };
}

function printHumanSummary(report: IntegrityReport): void {
  emitScriptInfo("=== Template Canonical Integrity Audit (read-only) ===");
  emitScriptInfo(`Scanned: ${report.scanned}`);
  emitScriptInfo(`Valid (unchanged): ${report.validUnchanged}`);
  emitScriptInfo(`Valid (strip/drift — DB zombie, runtime healed): ${report.validStripDrift}`);
  emitScriptInfo(`Invalid (Zod fail — GET + instantiate both 422): ${report.invalid}`);
  emitScriptInfo("");
  emitScriptInfo("Top 5 problematic JSON paths:");
  if (report.top5IssuePaths.length === 0) {
    emitScriptInfo("  (none — all rows clean)");
  } else {
    for (const [index, entry] of report.top5IssuePaths.entries()) {
      emitScriptInfo(
        `  ${index + 1}. ${entry.issuePath} — ${entry.count} hit(s) [zod=${entry.breakdown.zodFailures}, fossil=${entry.breakdown.topLevelFossils}, drift=${entry.breakdown.deepDrift}]`,
      );
    }
  }
  emitScriptInfo("");
  emitScriptInfo("High-risk assessment:");
  emitScriptInfo(
    `  GET-works / instantiate-fails (canonical split): ${report.highRisk.getWorksInstantiateFailsCanonical.count} row(s)`,
  );
  emitScriptInfo(`  Hard corrupt (422 on GET + instantiate): ${report.highRisk.hardCorruptBothEndpointsFail.count} row(s)`);
  emitScriptInfo(
    `  Soft zombie (DB drift, healed at read): ${report.highRisk.softZombieDbDriftHealedAtRuntime.count} row(s)`,
  );

  if (report.highRisk.hardCorruptBothEndpointsFail.count > 0) {
    emitScriptInfo("");
    emitScriptInfo("Hard-corrupt workspaces:");
    for (const entry of report.highRisk.hardCorruptBothEndpointsFail.byWorkspace) {
      emitScriptInfo(
        `  workspace=${entry.workspaceId} template=${entry.templateId} paths=${entry.issuePaths.join(", ") || "(none)"}`,
      );
    }
  }

  if (report.highRisk.softZombieDbDriftHealedAtRuntime.count > 0) {
    emitScriptInfo("");
    emitScriptInfo("Soft-zombie workspaces (run migrate:template-canonical --apply to persist fix):");
    for (const entry of report.highRisk.softZombieDbDriftHealedAtRuntime.byWorkspace) {
      emitScriptInfo(
        `  workspace=${entry.workspaceId} template=${entry.templateId} drift=${entry.driftPaths.join(", ") || "(none)"}`,
      );
    }
  }
}

async function main(): Promise<void> {
  const { jsonOut } = parseArgs(process.argv.slice(2));

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    const dbRows = await dataSource.query<TemplateRow[]>(
      `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides, updated_at
       FROM workspace_tour_wizard_templates
       ORDER BY workspace_id, id`,
    );

    const rowAudits = dbRows.map(auditRow);
    const report = buildReport(rowAudits);

    printHumanSummary(report);
    emitScriptInfo("");
    emitScriptInfo(JSON.stringify({ summary: {
      generatedAt: report.generatedAt,
      scanned: report.scanned,
      validUnchanged: report.validUnchanged,
      validStripDrift: report.validStripDrift,
      invalid: report.invalid,
      top5IssuePaths: report.top5IssuePaths,
      highRisk: report.highRisk,
    } }, null, 2));

    if (jsonOut) {
      const resolvedPath = path.resolve(jsonOut);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      emitScriptInfo(`Full report written: ${resolvedPath}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
