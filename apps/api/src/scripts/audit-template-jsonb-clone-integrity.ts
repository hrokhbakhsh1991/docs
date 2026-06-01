/**
 * Deep-clone integrity audit for workspace_tour_wizard_templates JSONB columns.
 *
 * 1. Selects a source row (richest canonical_data, or --template-id=).
 * 2. Deep-clones canonical_data, field_rules_overlay, step_overrides via structuredClone.
 * 3. Inserts a clone row under a workspace without an existing template (rolled back).
 * 4. Compares source vs clone JSONB (deep equality) and scans for envelope id leaks.
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-jsonb-clone-integrity
 *   pnpm --filter @apps/api audit:template-jsonb-clone-integrity -- --template-id=<uuid>
 *   pnpm --filter @apps/api audit:template-jsonb-clone-integrity -- --json-out=./reports/template-clone-audit.json
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

type TemplateRow = {
  id: string;
  workspace_id: string;
  base_profile: string;
  canonical_data: unknown;
  field_rules_overlay: unknown;
  step_overrides: unknown;
  preset_id: string | null;
  wizard_contract_version: number;
  form_profile_version: number;
};

type JsonPathHit = {
  path: string;
  value: string;
  kind: "template_id" | "workspace_id" | "preset_id";
};

type CloneIntegrityReport = {
  generatedAt: string;
  mode: "db_transaction" | "in_memory_only";
  usedSyntheticRichFixture: boolean;
  source: {
    id: string;
    workspaceId: string;
    baseProfile: string;
    canonicalBytes: number;
    overlayBytes: number;
    overlayKeyCount: number;
  };
  clone: {
    id: string;
    workspaceId: string;
  };
  jsonbParity: {
    canonicalDataEqual: boolean;
    fieldRulesOverlayEqual: boolean;
    stepOverridesEqual: boolean;
    canonicalDiffPaths: string[];
    overlayDiffPaths: string[];
    stepOverridesDiffPaths: string[];
  };
  envelopeLeakScan: {
    cloneContainsSourceTemplateId: boolean;
    cloneContainsSourceWorkspaceId: boolean;
    cloneContainsSourcePresetId: boolean;
    hits: JsonPathHit[];
  };
  rowEnvelope: {
    cloneIdDiffersFromSource: boolean;
    cloneWorkspaceDiffersFromSource: boolean;
  };
  pass: boolean;
};

function parseArgs(argv: string[]): { templateId?: string; jsonOut?: string } {
  let templateId: string | undefined;
  let jsonOut: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--template-id=")) {
      templateId = arg.slice("--template-id=".length).trim() || undefined;
    }
    if (arg.startsWith("--json-out=")) {
      jsonOut = arg.slice("--json-out=".length).trim() || undefined;
    }
  }
  return { templateId, jsonOut };
}

function deepCloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return structuredClone(value);
}

function jsonByteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function deepDiffPaths(
  left: unknown,
  right: unknown,
  prefix = "",
  out: string[] = [],
): string[] {
  if (Object.is(left, right)) {
    return out;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    const max = Math.max(left.length, right.length);
    for (let index = 0; index < max; index += 1) {
      const segment = `${prefix}[${index}]`;
      if (index >= left.length) {
        out.push(`${segment}: missing in left`);
        continue;
      }
      if (index >= right.length) {
        out.push(`${segment}: missing in right`);
        continue;
      }
      deepDiffPaths(left[index], right[index], segment, out);
    }
    return out;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const segment = prefix ? `${prefix}.${key}` : key;
      if (!(key in left)) {
        out.push(`${segment}: missing in left`);
        continue;
      }
      if (!(key in right)) {
        out.push(`${segment}: missing in right`);
        continue;
      }
      deepDiffPaths(left[key], right[key], segment, out);
    }
    return out;
  }
  out.push(`${prefix || "(root)"}: ${JSON.stringify(left)} !== ${JSON.stringify(right)}`);
  return out;
}

function collectEnvelopeStringHits(
  value: unknown,
  forbidden: { templateId: string; workspaceId: string; presetId: string | null },
  path = "",
  hits: JsonPathHit[] = [],
): JsonPathHit[] {
  if (value === null || value === undefined) {
    return hits;
  }
  if (typeof value === "string") {
    if (value === forbidden.templateId) {
      hits.push({ path, value, kind: "template_id" });
    }
    if (value === forbidden.workspaceId) {
      hits.push({ path, value, kind: "workspace_id" });
    }
    if (forbidden.presetId && value === forbidden.presetId) {
      hits.push({ path, value, kind: "preset_id" });
    }
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectEnvelopeStringHits(entry, forbidden, `${path}[${index}]`, hits);
    });
    return hits;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const segment = path ? `${path}.${key}` : key;
      collectEnvelopeStringHits(nested, forbidden, segment, hits);
    }
  }
  return hits;
}

async function loadSourceTemplate(
  dataSource: DataSource,
  templateId?: string,
): Promise<TemplateRow | null> {
  if (templateId) {
    const rows = await dataSource.query<TemplateRow[]>(
      `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides,
              preset_id, wizard_contract_version, form_profile_version
       FROM workspace_tour_wizard_templates
       WHERE id = $1
       LIMIT 1`,
      [templateId],
    );
    return rows[0] ?? null;
  }

  const rows = await dataSource.query<TemplateRow[]>(
    `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides,
            preset_id, wizard_contract_version, form_profile_version
     FROM workspace_tour_wizard_templates
     WHERE canonical_data::text <> '{}'
        OR field_rules_overlay::text <> '{}'
     ORDER BY (
       pg_column_size(COALESCE(canonical_data, '{}'::jsonb)) +
       pg_column_size(COALESCE(field_rules_overlay, '{}'::jsonb))
     ) DESC
     LIMIT 1`,
  );
  if (rows[0]) {
    return rows[0];
  }

  const fallback = await dataSource.query<TemplateRow[]>(
    `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides,
            preset_id, wizard_contract_version, form_profile_version
     FROM workspace_tour_wizard_templates
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  return fallback[0] ?? null;
}

async function findSpareWorkspaceId(dataSource: DataSource, excludeWorkspaceId: string): Promise<string | null> {
  const rows = await dataSource.query<Array<{ id: string }>>(
    `SELECT ten.id
     FROM tenants ten
     WHERE ten.deleted_at IS NULL
       AND ten.id <> $1
       AND NOT EXISTS (
         SELECT 1
         FROM workspace_tour_wizard_templates wt
         WHERE wt.workspace_id = ten.id
       )
     LIMIT 1`,
    [excludeWorkspaceId],
  );
  return rows[0]?.id ?? null;
}

const SYNTHETIC_RICH_FIXTURE = {
  canonical_data: {
    category: "mountain",
    duration: "multi",
    title: "Clone integrity probe",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    leaderUserIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b22"],
    program: {
      shortDescription: "Synthetic Layer A seed for clone audit",
      themeIds: ["c1eebc99-9c0b-4ef8-bb6d-6bb9bd380c33"],
      itinerary: [{ day: 1, activities: "Approach" }],
    },
    transport: { mode: "bus", transportCost: 120000 },
    pricing: { requiresPayment: true, basePricePerPerson: 850000 },
    photos: [{ id: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380d44", url: "https://example.invalid/1.jpg" }],
  },
  field_rules_overlay: {
    title: { visibility: "always", required: "required" },
    "program.itinerary": { visibility: "active", required: "optional" },
    "transport.mode": { visibility: "always", required: "" },
  },
  step_overrides: { skip: [], insert: [] },
} as const;

async function main(): Promise<void> {
  const { templateId, jsonOut } = parseArgs(process.argv.slice(2));
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    let source = await loadSourceTemplate(dataSource, templateId);
    let usedSyntheticFixture = false;
    if (!source) {
      throw new Error("No source workspace_tour_wizard_templates row found for clone audit");
    }

    const sourceCanonicalBytes = jsonByteSize(source.canonical_data);
    const sourceOverlayBytes = jsonByteSize(source.field_rules_overlay);
    if (sourceCanonicalBytes <= 2 && sourceOverlayBytes <= 2) {
      usedSyntheticFixture = true;
      source = {
        ...source,
        canonical_data: structuredClone(SYNTHETIC_RICH_FIXTURE.canonical_data),
        field_rules_overlay: structuredClone(SYNTHETIC_RICH_FIXTURE.field_rules_overlay),
        step_overrides: structuredClone(SYNTHETIC_RICH_FIXTURE.step_overrides),
      };
    }

    const clonedCanonical = deepCloneJson(source.canonical_data ?? {});
    const clonedOverlay = deepCloneJson(source.field_rules_overlay ?? {});
    const clonedStepOverrides = deepCloneJson(source.step_overrides ?? { skip: [], insert: [] });

    const inMemoryCanonicalEqual =
      deepDiffPaths(source.canonical_data ?? {}, clonedCanonical).length === 0;
    const inMemoryOverlayEqual = deepDiffPaths(source.field_rules_overlay ?? {}, clonedOverlay).length === 0;
    const inMemoryStepEqual =
      deepDiffPaths(source.step_overrides ?? { skip: [], insert: [] }, clonedStepOverrides).length === 0;

    const spareWorkspaceId = await findSpareWorkspaceId(dataSource, source.workspace_id);
    const cloneId = randomUUID();
    const cloneWorkspaceId = spareWorkspaceId ?? source.workspace_id;

    let dbCloneRow: TemplateRow | null = null;
    let mode: CloneIntegrityReport["mode"] = "in_memory_only";

    if (spareWorkspaceId) {
      mode = "db_transaction";
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await queryRunner.query(
          `INSERT INTO workspace_tour_wizard_templates (
             id, workspace_id, base_profile, step_overrides, field_rules_overlay, canonical_data,
             preset_id, wizard_contract_version, form_profile_version, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb,
             $7, $8, $9, NOW(), NOW()
           )`,
          [
            cloneId,
            cloneWorkspaceId,
            source.base_profile,
            JSON.stringify(clonedStepOverrides),
            JSON.stringify(clonedOverlay),
            JSON.stringify(clonedCanonical),
            source.preset_id,
            source.wizard_contract_version,
            source.form_profile_version,
          ],
        );

        const rows = (await queryRunner.query(
          `SELECT id, workspace_id, base_profile, canonical_data, field_rules_overlay, step_overrides,
                  preset_id, wizard_contract_version, form_profile_version
           FROM workspace_tour_wizard_templates
           WHERE id = $1
           LIMIT 1`,
          [cloneId],
        )) as any[];
        dbCloneRow = (rows[0] as TemplateRow | undefined) ?? null;
      } finally {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
      }
    }

    const compareCanonicalLeft = source.canonical_data ?? {};
    const compareCanonicalRight = dbCloneRow?.canonical_data ?? clonedCanonical;
    const compareOverlayLeft = source.field_rules_overlay ?? {};
    const compareOverlayRight = dbCloneRow?.field_rules_overlay ?? clonedOverlay;
    const compareStepLeft = source.step_overrides ?? { skip: [], insert: [] };
    const compareStepRight = dbCloneRow?.step_overrides ?? clonedStepOverrides;

    const canonicalDiffPaths = deepDiffPaths(compareCanonicalLeft, compareCanonicalRight);
    const overlayDiffPaths = deepDiffPaths(compareOverlayLeft, compareOverlayRight);
    const stepDiffPaths = deepDiffPaths(compareStepLeft, compareStepRight);

    const leakTargets = {
      templateId: source.id,
      workspaceId: source.workspace_id,
      presetId: source.preset_id,
    };
    const leakHits = collectEnvelopeStringHits(
      {
        canonical_data: compareCanonicalRight,
        field_rules_overlay: compareOverlayRight,
        step_overrides: compareStepRight,
      },
      leakTargets,
    );

    const report: CloneIntegrityReport = {
      generatedAt: new Date().toISOString(),
      mode,
      usedSyntheticRichFixture: usedSyntheticFixture,
      source: {
        id: source.id,
        workspaceId: source.workspace_id,
        baseProfile: source.base_profile,
        canonicalBytes: jsonByteSize(source.canonical_data),
        overlayBytes: jsonByteSize(source.field_rules_overlay),
        overlayKeyCount: isPlainObject(source.field_rules_overlay)
          ? Object.keys(source.field_rules_overlay).length
          : 0,
      },
      clone: {
        id: dbCloneRow?.id ?? cloneId,
        workspaceId: dbCloneRow?.workspace_id ?? cloneWorkspaceId,
      },
      jsonbParity: {
        canonicalDataEqual: canonicalDiffPaths.length === 0,
        fieldRulesOverlayEqual: overlayDiffPaths.length === 0,
        stepOverridesEqual: stepDiffPaths.length === 0,
        canonicalDiffPaths: canonicalDiffPaths.slice(0, 25),
        overlayDiffPaths: overlayDiffPaths.slice(0, 25),
        stepOverridesDiffPaths: stepDiffPaths.slice(0, 25),
      },
      envelopeLeakScan: {
        cloneContainsSourceTemplateId: leakHits.some((hit) => hit.kind === "template_id"),
        cloneContainsSourceWorkspaceId: leakHits.some((hit) => hit.kind === "workspace_id"),
        cloneContainsSourcePresetId: leakHits.some((hit) => hit.kind === "preset_id"),
        hits: leakHits.slice(0, 50),
      },
      rowEnvelope: {
        cloneIdDiffersFromSource: (dbCloneRow?.id ?? cloneId) !== source.id,
        cloneWorkspaceDiffersFromSource: (dbCloneRow?.workspace_id ?? cloneWorkspaceId) !== source.workspace_id,
      },
      pass:
        inMemoryCanonicalEqual &&
        inMemoryOverlayEqual &&
        inMemoryStepEqual &&
        canonicalDiffPaths.length === 0 &&
        overlayDiffPaths.length === 0 &&
        stepDiffPaths.length === 0 &&
        leakHits.length === 0 &&
        (mode === "in_memory_only" || (dbCloneRow != null && dbCloneRow.id !== source.id)),
    };

    if (jsonOut) {
      const resolved = path.resolve(jsonOut);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      emitScriptInfo(`Wrote ${resolved}`);
    }

    emitScriptInfo(JSON.stringify(report, null, 2));

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
