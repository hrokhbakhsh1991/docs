/**
 * Schema drift audit: compare stored `canonical_data` JSON paths against
 * {@link denaliCanonicalTemplateDataSchema} (DenaliCanonicalTemplateData).
 *
 * Samples 5 random workspace_tour_wizard_templates rows (or --sample-count=N).
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-canonical-zod-drift
 *   pnpm --filter @apps/api audit:template-canonical-zod-drift -- --json-out=./reports/template-canonical-zod-drift.json
 *   pnpm --filter @apps/api audit:template-canonical-zod-drift -- --markdown-out=../../audit-report.md
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import fs from "node:fs";
import path from "node:path";

import {
  collectDiscardedTemplateKeys,
  denaliCanonicalTemplateDataSchema,
  DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS,
  validateDenaliCanonicalTemplateData,
} from "@repo/types/denali";
import { DataSource } from "typeorm";
import { z } from "zod";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

type TemplateRow = {
  id: string;
  workspace_id: string;
  base_profile: string;
  canonical_data: unknown;
  updated_at: string;
};

type TemplateDriftRow = {
  id: string;
  workspaceId: string;
  baseProfile: string;
  updatedAt: string;
  canonicalTopLevelKeyCount: number;
  zodOk: boolean;
  dbPathsNotInSchema: string[];
  discardedTopLevelKeys: string[];
  zodUnrecognizedIssues: string[];
  presentNormalizedPaths: string[];
};

type ZodDriftReport = {
  generatedAt: string;
  sampleCount: number;
  schemaTopLevelKeys: readonly string[];
  schemaAllowedPathCount: number;
  perTemplate: TemplateDriftRow[];
  aggregate: {
    dbPathsNotInSchema: string[];
    discardedTopLevelKeys: string[];
    schemaPathsNeverPresentInSample: string[];
    schemaTopLevelKeysNeverPresentInSample: string[];
  };
  pass: boolean;
};

function parseArgs(argv: string[]): {
  sampleCount: number;
  jsonOut: string | null;
  markdownOut: string | null;
  seed: string | null;
} {
  const sampleArg = argv.find((arg) => arg.startsWith("--sample-count="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const seedArg = argv.find((arg) => arg.startsWith("--seed="));
  return {
    sampleCount: sampleArg ? Math.max(1, Number.parseInt(sampleArg.slice("--sample-count=".length), 10)) : 5,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    seed: seedArg ? seedArg.slice("--seed=".length) : null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

type ZodRuntimeDef = {
  type: string;
  innerType?: z.ZodTypeAny;
  shape?: Record<string, z.ZodTypeAny>;
  element?: z.ZodTypeAny;
};

function getZodRuntimeDef(schema: z.ZodTypeAny): ZodRuntimeDef | null {
  const wrapped = schema as z.ZodTypeAny & { _zod?: { def: ZodRuntimeDef }; _def?: ZodRuntimeDef };
  return wrapped._zod?.def ?? wrapped._def ?? null;
}

function unwrapZodType(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur = schema;
  for (;;) {
    const def = getZodRuntimeDef(cur);
    if (!def) {
      break;
    }
    if (def.type === "optional" || def.type === "default" || def.type === "nullable") {
      cur = def.innerType as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return cur;
}

/** All dot-path prefixes declared on the strict template canonical Zod tree (arrays use `[]`). */
function collectSchemaPaths(schema: z.ZodTypeAny, prefix = ""): Set<string> {
  const unwrapped = unwrapZodType(schema);
  const def = getZodRuntimeDef(unwrapped);
  const paths = new Set<string>();
  if (prefix) {
    paths.add(prefix);
  }
  if (!def) {
    return paths;
  }

  if (def.type === "object" && def.shape) {
    for (const [key, child] of Object.entries(def.shape)) {
      const segment = prefix ? `${prefix}.${key}` : key;
      paths.add(segment);
      for (const sub of collectSchemaPaths(child, segment)) {
        paths.add(sub);
      }
    }
    return paths;
  }

  if (def.type === "array" && def.element) {
    const arrayPrefix = prefix ? `${prefix}[]` : "[]";
    paths.add(arrayPrefix);
    for (const sub of collectSchemaPaths(def.element, arrayPrefix)) {
      paths.add(sub);
    }
    return paths;
  }

  return paths;
}

function normalizePathForCompare(dotPath: string): string {
  return dotPath.replace(/\[\d+\]/g, "[]");
}

/** Collect dot-paths for every key present in stored JSON (arrays indexed, then normalized). */
function collectPresentJsonPaths(value: unknown, prefix = ""): Set<string> {
  const paths = new Set<string>();
  if (value === null || value === undefined) {
    return paths;
  }

  if (Array.isArray(value)) {
    const arrayPrefix = prefix ? `${prefix}[]` : "[]";
    paths.add(normalizePathForCompare(arrayPrefix));
    for (let index = 0; index < value.length; index += 1) {
      const segment = prefix ? `${prefix}[${index}]` : `[${index}]`;
      for (const sub of collectPresentJsonPaths(value[index], segment)) {
        paths.add(normalizePathForCompare(sub));
      }
    }
    return paths;
  }

  if (isPlainObject(value)) {
    if (prefix) {
      paths.add(normalizePathForCompare(prefix));
    }
    for (const [key, child] of Object.entries(value)) {
      const segment = prefix ? `${prefix}.${key}` : key;
      paths.add(normalizePathForCompare(segment));
      for (const sub of collectPresentJsonPaths(child, segment)) {
        paths.add(sub);
      }
    }
    return paths;
  }

  if (prefix) {
    paths.add(normalizePathForCompare(prefix));
  }
  return paths;
}

/** Walk stored JSON against the Zod tree; return paths for keys not declared on the schema. */
function collectDbPathsNotInSchema(value: unknown, schema: z.ZodTypeAny, prefix = ""): string[] {
  const unwrapped = unwrapZodType(schema);
  const def = getZodRuntimeDef(unwrapped);
  const unknownPaths: string[] = [];

  if (value === null || value === undefined) {
    return unknownPaths;
  }

  if (def?.type === "object" && def.shape) {
    if (!isPlainObject(value)) {
      unknownPaths.push(prefix || "<root>");
      return unknownPaths;
    }
    for (const key of Object.keys(value)) {
      const segment = prefix ? `${prefix}.${key}` : key;
      const childSchema = def.shape[key];
      if (!childSchema) {
        unknownPaths.push(segment);
        continue;
      }
      unknownPaths.push(...collectDbPathsNotInSchema(value[key], childSchema, segment));
    }
    return unknownPaths;
  }

  if (def?.type === "array" && def.element) {
    if (!Array.isArray(value)) {
      unknownPaths.push(prefix || "<root>");
      return unknownPaths;
    }
    for (let index = 0; index < value.length; index += 1) {
      const segment = prefix ? `${prefix}[${index}]` : `[${index}]`;
      unknownPaths.push(...collectDbPathsNotInSchema(value[index], def.element, segment));
    }
    return unknownPaths;
  }

  return unknownPaths;
}

function uniqueSorted(paths: Iterable<string>): string[] {
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

function auditTemplateRow(row: TemplateRow): TemplateDriftRow {
  const canonical = row.canonical_data;
  const validation = validateDenaliCanonicalTemplateData(canonical);
  const dbPathsNotInSchema = uniqueSorted(collectDbPathsNotInSchema(canonical, denaliCanonicalTemplateDataSchema));
  const discardedTopLevelKeys = collectDiscardedTemplateKeys(canonical);
  const presentNormalizedPaths = uniqueSorted(collectPresentJsonPaths(canonical));
  const zodUnrecognizedIssues = uniqueSorted(
    validation.ok ? [] : validation.issues.map((issue) => issue.path),
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    baseProfile: row.base_profile,
    updatedAt: row.updated_at,
    canonicalTopLevelKeyCount: isPlainObject(canonical) ? Object.keys(canonical).length : 0,
    zodOk: validation.ok,
    dbPathsNotInSchema,
    discardedTopLevelKeys,
    zodUnrecognizedIssues,
    presentNormalizedPaths,
  };
}

function buildAggregate(
  perTemplate: TemplateDriftRow[],
  schemaPaths: Set<string>,
): ZodDriftReport["aggregate"] {
  const presentUnion = new Set<string>();
  for (const row of perTemplate) {
    for (const p of row.presentNormalizedPaths) {
      presentUnion.add(p);
    }
  }

  const schemaPathsNeverPresentInSample = uniqueSorted(
    [...schemaPaths].filter((schemaPath) => !presentUnion.has(schemaPath)),
  );

  const schemaTopLevelKeysNeverPresentInSample = DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS.filter(
    (key) => !presentUnion.has(key),
  ).sort();

  return {
    dbPathsNotInSchema: uniqueSorted(perTemplate.flatMap((row) => row.dbPathsNotInSchema)),
    discardedTopLevelKeys: uniqueSorted(perTemplate.flatMap((row) => row.discardedTopLevelKeys)),
    schemaPathsNeverPresentInSample,
    schemaTopLevelKeysNeverPresentInSample,
  };
}

function formatMarkdownSection(report: ZodDriftReport, requestedSampleCount: number): string {
  const sampleNote =
    report.sampleCount < requestedSampleCount
      ? `${report.sampleCount} of ${requestedSampleCount} requested random \`workspace_tour_wizard_templates\` rows (DB has ${report.sampleCount} total)`
      : `${report.sampleCount} random \`workspace_tour_wizard_templates\` rows`;

  const lines: string[] = [
    "",
    "---",
    "",
    "## Schema Drift Audit — `canonical_data` vs `DenaliCanonicalTemplateData` Zod (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter @apps/api audit:template-canonical-zod-drift\` (\`apps/api/src/scripts/audit-template-canonical-zod-drift.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Sample:** ${sampleNote}`,
    "",
    `**Schema authority:** \`denaliCanonicalTemplateDataSchema\` (strict deep-partial; ${report.schemaAllowedPathCount} declared path prefixes)`,
    "",
    "### Aggregate drift",
    "",
    "| Direction | Count | Detail |",
    "|-----------|-------|--------|",
    `| DB → not in Zod (nested unknown keys) | ${report.aggregate.dbPathsNotInSchema.length} | ${report.aggregate.dbPathsNotInSchema.length ? report.aggregate.dbPathsNotInSchema.slice(0, 20).join(", ") + (report.aggregate.dbPathsNotInSchema.length > 20 ? "…" : "") : "—" } |`,
    `| DB → discarded top-level (allow-list strip) | ${report.aggregate.discardedTopLevelKeys.length} | ${report.aggregate.discardedTopLevelKeys.length ? report.aggregate.discardedTopLevelKeys.join(", ") : "—" } |`,
    `| Zod → never present in sample (nested path prefixes) | ${report.aggregate.schemaPathsNeverPresentInSample.length} | See artifact (expected for deep-partial templates) |`,
    `| Zod → top-level never present in sample | ${report.aggregate.schemaTopLevelKeysNeverPresentInSample.length} | ${report.aggregate.schemaTopLevelKeysNeverPresentInSample.length ? report.aggregate.schemaTopLevelKeysNeverPresentInSample.join(", ") : "—" } |`,
    "",
    "### Per-template",
    "",
    "| Template | Workspace | Profile | Zod OK | Top-level keys | DB∉Zod | Discarded roots |",
    "|----------|-----------|---------|--------|----------------|--------|-----------------|",
  ];

  for (const row of report.perTemplate) {
    lines.push(
      `| \`${row.id.slice(0, 8)}…\` | \`${row.workspaceId.slice(0, 8)}…\` | ${row.baseProfile} | ${row.zodOk ? "yes" : "**no**"} | ${row.canonicalTopLevelKeyCount} | ${row.dbPathsNotInSchema.length} | ${row.discardedTopLevelKeys.length ? row.discardedTopLevelKeys.join(", ") : "—"} |`,
    );
  }

  lines.push(
    "",
    `**Pass (no DB keys outside Zod, no discarded roots):** ${report.pass ? "**yes**" : "**no**"}`,
    "",
    "**Artifact:** `reports/template-canonical-zod-drift.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Schema Drift Audit — `canonical_data` vs `DenaliCanonicalTemplateData` Zod";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
  emitScriptInfo(`Appended schema drift section to ${resolved}`);
}

async function main(): Promise<void> {
  const { sampleCount, jsonOut, markdownOut, seed } = parseArgs(process.argv.slice(2));
  const schemaPaths = collectSchemaPaths(denaliCanonicalTemplateDataSchema);

  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    const orderClause = seed ? `ORDER BY md5(id::text || '${seed.replace(/'/g, "''")}')` : "ORDER BY RANDOM()";
    const rows = (await dataSource.query(
      `
      SELECT id, workspace_id, base_profile, canonical_data, updated_at
      FROM workspace_tour_wizard_templates
      ${orderClause}
      LIMIT $1
      `,
      [sampleCount],
    )) as TemplateRow[];

    const perTemplate = rows.map((row) => auditTemplateRow(row));
    const aggregate = buildAggregate(perTemplate, schemaPaths);

    const report: ZodDriftReport = {
      generatedAt: new Date().toISOString(),
      sampleCount: rows.length,
      schemaTopLevelKeys: DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS,
      schemaAllowedPathCount: schemaPaths.size,
      perTemplate,
      aggregate,
      pass:
        aggregate.dbPathsNotInSchema.length === 0 && aggregate.discardedTopLevelKeys.length === 0,
    };

    const jsonTarget =
      jsonOut ?? path.join(process.cwd(), "reports", "template-canonical-zod-drift.json");
    const jsonResolved = path.resolve(jsonTarget);
    fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
    fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    emitScriptInfo(`Wrote ${jsonResolved}`);

    const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
    appendMarkdown(mdTarget, formatMarkdownSection(report, sampleCount));

    emitScriptInfo(JSON.stringify({ pass: report.pass, sampleCount: report.sampleCount, aggregate }, null, 2));

    if (!report.pass) {
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
