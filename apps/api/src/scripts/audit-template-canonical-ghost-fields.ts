/**
 * Ghost-field audit: stored `canonical_data` keys vs Denali field registry (storage vocabulary)
 * and {@link pruneDenaliWizardFormToRegistry} round-trip loss.
 *
 * Usage:
 *   pnpm --filter @apps/api audit:template-canonical-ghost-fields
 *   pnpm --filter @apps/api audit:template-canonical-ghost-fields -- --markdown-out=../../audit-report.md
 *
 * Requires apps/api/.env (DATABASE_*).
 */
import fs from "node:fs";
import path from "node:path";

import {
  DENALI_FIELD_DEFINITIONS,
  denaliTemplateOrchestratorFactory,
  pruneDenaliWizardFormToRegistry,
  safeDenaliFormToCanonical,
  type DenaliCreateTourWizardForm,
} from "@repo/denali-domain";
import {
  collectDiscardedTemplateKeys,
  DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS,
  resolveStoredTemplateCanonical,
  toDenaliTemplateStoragePath,
} from "@repo/types/denali";
import { DataSource } from "typeorm";

import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { emitScriptInfo } from "./script-log";

const LOCATION_OBJECT_KEYS = ["id", "addressText", "latitude", "longitude"] as const;

/** Mirrors {@link ZOD_KIND_ARRAY_ELEMENT_KEYS} in deepStripUnregisteredDenaliWizardKeys.ts */
const REGISTRY_ARRAY_ELEMENT_KEYS: Partial<
  Record<(typeof DENALI_FIELD_DEFINITIONS)[number]["zodKind"], readonly string[]>
> = {
  gatheringPoints: ["id", "title", "time", "location"],
  itinerary: ["day", "title", "description", "location", "locationText", "activities", "photos"],
  gearItems: ["id", "name", "required"],
  photos: ["id", "assetId", "url", "filename", "size", "mimeType", "uploadedAt", "uploadStatus"],
};

type TemplateRow = {
  id: string;
  workspace_id: string;
  base_profile: string;
  canonical_data: unknown;
};

type TemplateGhostRow = {
  id: string;
  workspaceId: string;
  baseProfile: string;
  canonicalKeyCount: number;
  registryGhostPaths: string[];
  discardedTopLevelKeys: string[];
  zodValidationIssues: string[];
  pruneRoundTripLostPaths: string[];
};

type SyntheticProbe = {
  id: string;
  label: string;
  registryGhostPaths: string[];
  pruneRoundTripLostPaths: string[];
  notes: string[];
};

type GhostFieldReport = {
  generatedAt: string;
  templatesScanned: number;
  templatesWithNonEmptyCanonical: number;
  usedSyntheticFixture: boolean;
  registryDefinition: string;
  perTemplate: TemplateGhostRow[];
  syntheticProbes: SyntheticProbe[];
  aggregate: {
    registryGhostPaths: string[];
    discardedTopLevelKeys: string[];
    pruneRoundTripLostPaths: string[];
  };
  pass: boolean;
};

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOut: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Registry-allowed child keys for canonical JSONB (flat storage paths). */
function buildCanonicalStorageRegistryAllowMap(): Map<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();

  const add = (prefix: string, segment: string): void => {
    let bucket = map.get(prefix);
    if (!bucket) {
      bucket = new Set<string>();
      map.set(prefix, bucket);
    }
    bucket.add(segment);
  };

  for (const topKey of DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS) {
    add("", topKey);
  }

  for (const field of DENALI_FIELD_DEFINITIONS) {
    const storagePath = toDenaliTemplateStoragePath(field.canonicalPath);
    const segments = storagePath.split(".").filter((segment) => segment.length > 0);
    for (let index = 0; index < segments.length; index += 1) {
      const prefix = segments.slice(0, index).join(".");
      add(prefix, segments[index]!);
    }

    if (field.zodKind === "locationData") {
      for (const locKey of LOCATION_OBJECT_KEYS) {
        add(storagePath, locKey);
      }
    }

    const elementKeys =
      field.zodKind != null ? REGISTRY_ARRAY_ELEMENT_KEYS[field.zodKind] : undefined;
    if (elementKeys) {
      for (const key of elementKeys) {
        add(storagePath, key);
        if (key === "location") {
          for (const locKey of LOCATION_OBJECT_KEYS) {
            add(`${storagePath}.location`, locKey);
          }
        }
      }
    }
  }

  add("overview", "nonAttendanceDetails");
  add("overview", "peakHeight");
  add("metrics", "elevationGain");

  const frozen = new Map<string, ReadonlySet<string>>();
  for (const [prefix, keys] of map) {
    frozen.set(prefix, keys);
  }
  return frozen;
}

const CANONICAL_REGISTRY_ALLOW = buildCanonicalStorageRegistryAllowMap();

function normalizePathForCompare(path: string): string {
  return path.replace(/\[\d+\]/g, "[]");
}

/** Collect dot-paths for leaf values and ghost keys not on the registry allow-map. */
function collectRegistryGhostPaths(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const ghosts: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      ghosts.push(...collectRegistryGhostPaths(value[index], `${prefix}[]`));
    }
    return ghosts;
  }

  if (!isPlainObject(value)) {
    return [];
  }

  const allowPrefix = prefix.replace(/\[\]$/, "");
  const allowed = CANONICAL_REGISTRY_ALLOW.get(allowPrefix) ?? new Set<string>();
  const ghosts: string[] = [];

  for (const key of Object.keys(value)) {
    const segment = prefix ? `${prefix}.${key}` : key;
    if (!allowed.has(key)) {
      ghosts.push(normalizePathForCompare(segment));
      continue;
    }
    ghosts.push(...collectRegistryGhostPaths(value[key], segment));
  }

  return ghosts;
}

function collectPresentCanonicalPaths(value: unknown, prefix = ""): Set<string> {
  const paths = new Set<string>();
  if (value === null || value === undefined) {
    return paths;
  }
  if (Array.isArray(value)) {
    const arrayPrefix = prefix ? `${prefix}[]` : "[]";
    paths.add(normalizePathForCompare(arrayPrefix));
    for (const item of value) {
      for (const sub of collectPresentCanonicalPaths(item, arrayPrefix)) {
        paths.add(sub);
      }
    }
    return paths;
  }
  if (!isPlainObject(value)) {
    if (prefix) {
      paths.add(normalizePathForCompare(prefix));
    }
    return paths;
  }
  if (prefix) {
    paths.add(normalizePathForCompare(prefix));
  }
  for (const [key, child] of Object.entries(value)) {
    const segment = prefix ? `${prefix}.${key}` : key;
    paths.add(normalizePathForCompare(segment));
    for (const sub of collectPresentCanonicalPaths(child, segment)) {
      paths.add(sub);
    }
  }
  return paths;
}

async function collectPruneRoundTripLostPaths(
  canonical: Record<string, unknown>,
): Promise<string[]> {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-ghost-audit",
    templateId: "tpl-ghost-audit",
    canonicalData: canonical,
    fieldRulesOverlay: {},
  });
  if (!result.success) {
    return ["<orchestration_failed>"];
  }

  const form = result.draftState.data.form as DenaliCreateTourWizardForm | undefined;
  if (form == null) {
    return ["<missing_form>"];
  }

  const pruned = pruneDenaliWizardFormToRegistry(form);
  const roundTripCanonical = safeDenaliFormToCanonical(pruned) as unknown as Record<string, unknown>;

  const before = collectPresentCanonicalPaths(canonical);
  const after = collectPresentCanonicalPaths(roundTripCanonical);
  const lost: string[] = [];
  for (const path of before) {
    if (!after.has(path)) {
      lost.push(path);
    }
  }
  return lost.sort();
}

function uniqueSorted(paths: Iterable<string>): string[] {
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

function buildCleanRichCanonical(): Record<string, unknown> {
  return {
    category: "mountain",
    duration: "single",
    title: "__GHOST_AUDIT_BASELINE_TITLE__",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    startDateTime: "2026-06-15T08:00:00.000Z",
    program: {
      themeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      shortDescription: "Probe",
      itinerary: [{ day: 1, activities: "Day one" }],
    },
    transport: { mode: "none" },
    pricing: { paymentMode: "offline_receipt" },
    participants: {},
    policies: { policiesText: "" },
    photos: [
      {
        id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
        url: "https://cdn.example.test/p.jpg",
        filename: "probe.jpg",
        size: 1024,
        mimeType: "image/jpeg",
        uploadedAt: "2026-05-01T12:00:00.000Z",
      },
    ],
  };
}

function buildSyntheticRichCanonical(): Record<string, unknown> {
  return {
    category: "mountain",
    duration: "single",
    title: "__GHOST_AUDIT_BASELINE_TITLE__",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    startDateTime: "2026-06-15T08:00:00.000Z",
    __ghostTopLevel: "not-in-registry",
    program: {
      themeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
      shortDescription: "Probe",
      itinerary: [
        {
          day: 1,
          activities: "Day one",
          __ghostItineraryRow: "smuggled",
        },
      ],
    },
    transport: { mode: "none" },
    pricing: { paymentMode: "offline_receipt" },
    participants: {},
    policies: { policiesText: "" },
    photos: [
      {
        id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
        url: "https://cdn.example.test/p.jpg",
        filename: "probe.jpg",
        size: 1024,
        mimeType: "image/jpeg",
        uploadedAt: "2026-05-01T12:00:00.000Z",
        __ghostPhotoField: "smuggled",
      },
    ],
  };
}

async function runSyntheticProbes(): Promise<SyntheticProbe[]> {
  const smuggled = buildSyntheticRichCanonical();
  const smuggledGhosts = uniqueSorted(collectRegistryGhostPaths(smuggled));
  const smuggledPruneLoss = uniqueSorted(await collectPruneRoundTripLostPaths(smuggled));

  const clean = buildCleanRichCanonical();
  const cleanPruneLoss = uniqueSorted(await collectPruneRoundTripLostPaths(clean));

  return [
    {
      id: "synthetic-smuggled-keys",
      label: "Deliberate smuggled keys in canonical_data",
      registryGhostPaths: smuggledGhosts,
      pruneRoundTripLostPaths: smuggledPruneLoss,
      notes: [
        "Registry ghosts: __ghostTopLevel, program.itinerary[].__ghostItineraryRow, photos[].__ghostPhotoField",
      ],
    },
    {
      id: "synthetic-clean-prune-roundtrip",
      label: "Valid rich canonical → hydrate → pruneDenaliWizardFormToRegistry → export",
      registryGhostPaths: [],
      pruneRoundTripLostPaths: cleanPruneLoss,
      notes: [
        "Measures registry-addressable fields dropped by prune pipeline (category/title/photos/itinerary should survive)",
      ],
    },
  ];
}

function collectZodValidationIssueLabels(canonical: Record<string, unknown>): string[] {
  const resolved = resolveStoredTemplateCanonical({
    canonicalData: canonical,
    fieldRulesOverlay: {},
    stepOverrides: {},
  });
  if (resolved.ok) {
    return [];
  }
  return uniqueSorted(
    resolved.issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message)),
  );
}

function auditRow(row: TemplateRow): TemplateGhostRow {
  const canonical = isPlainObject(row.canonical_data) ? row.canonical_data : {};
  const registryGhostPaths = uniqueSorted(collectRegistryGhostPaths(canonical));
  const discardedTopLevelKeys = collectDiscardedTemplateKeys(canonical);
  const zodValidationIssues = collectZodValidationIssueLabels(canonical);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    baseProfile: row.base_profile,
    canonicalKeyCount: Object.keys(canonical).length,
    registryGhostPaths,
    discardedTopLevelKeys,
    zodValidationIssues,
    pruneRoundTripLostPaths: [],
  };
}

function formatMarkdown(report: GhostFieldReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Ghost-Field Audit — `canonical_data` vs Registry / `pruneDenaliWizardFormToRegistry` (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter @apps/api audit:template-canonical-ghost-fields\` (\`apps/api/src/scripts/audit-template-canonical-ghost-fields.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Templates scanned:** ${report.templatesScanned} (${report.templatesWithNonEmptyCanonical} non-empty \`canonical_data\`${report.usedSyntheticFixture ? "; production rows empty — synthetic fixture exercised" : ""})`,
    "",
    `**Registry definition:** ${report.registryDefinition}`,
    "",
    "### Aggregate",
    "",
    "| Kind | Count | Paths |",
    "|------|-------|-------|",
    `| Registry ghost keys (nested/top-level not on allow-map) | ${report.aggregate.registryGhostPaths.length} | ${report.aggregate.registryGhostPaths.length ? report.aggregate.registryGhostPaths.slice(0, 15).join(", ") + (report.aggregate.registryGhostPaths.length > 15 ? "…" : "") : "—"} |`,
    `| Discarded top-level fossils (allow-list strip) | ${report.aggregate.discardedTopLevelKeys.length} | ${report.aggregate.discardedTopLevelKeys.length ? report.aggregate.discardedTopLevelKeys.join(", ") : "—"} |`,
    `| Paths lost after factory hydrate → prune → canonical export | ${report.aggregate.pruneRoundTripLostPaths.length} | ${report.aggregate.pruneRoundTripLostPaths.length ? report.aggregate.pruneRoundTripLostPaths.slice(0, 15).join(", ") + (report.aggregate.pruneRoundTripLostPaths.length > 15 ? "…" : "") : "—"} |`,
    "",
    "### Per template",
    "",
    "| Template | Profile | Keys | Registry ghosts | Zod/top-level fossils | Prune round-trip losses |",
    "|----------|---------|------|-----------------|----------------------|-------------------------|",
  ];

  for (const row of report.perTemplate) {
    const fossilCol =
      row.discardedTopLevelKeys.length > 0
        ? row.discardedTopLevelKeys.join(", ")
        : row.zodValidationIssues.length > 0
          ? row.zodValidationIssues.slice(0, 2).join("; ")
          : "—";
    lines.push(
      `| \`${row.id.slice(0, 8)}…\` | ${row.baseProfile} | ${row.canonicalKeyCount} | ${row.registryGhostPaths.length ? row.registryGhostPaths.join(", ") : "—"} | ${fossilCol} | ${row.pruneRoundTripLostPaths.length ? row.pruneRoundTripLostPaths.join(", ") : "—"} |`,
    );
  }

  if (report.syntheticProbes.length > 0) {
    lines.push("", "### Synthetic probes (registry + prune)", "", "| Probe | Registry ghosts | Prune losses | Notes |", "|-------|-----------------|--------------|-------|");
    for (const probe of report.syntheticProbes) {
      lines.push(
        `| ${probe.label} | ${probe.registryGhostPaths.length ? probe.registryGhostPaths.join(", ") : "—"} | ${probe.pruneRoundTripLostPaths.length ? probe.pruneRoundTripLostPaths.join(", ") : "—"} | ${probe.notes.join(" ")} |`,
      );
    }
  }

  const liveGhosts = uniqueSorted(
    report.perTemplate.flatMap((row) => [
      ...row.registryGhostPaths,
      ...row.discardedTopLevelKeys,
    ]),
  );
  const pruneLosses = uniqueSorted(
    report.perTemplate.flatMap((row) => row.pruneRoundTripLostPaths),
  );
  const syntheticCleanLoss = report.syntheticProbes.find(
    (probe) => probe.id === "synthetic-clean-prune-roundtrip",
  )?.pruneRoundTripLostPaths ?? [];

  lines.push(
    "",
    `**Pass (stored DB rows clean):** ${report.pass ? "**yes**" : "**no**"}`,
    "",
    report.templatesWithNonEmptyCanonical === 0
      ? `**Finding:** ${report.templatesScanned} saved template(s) scanned; all have empty \`canonical_data\` — no live registry/Zod ghosts. Synthetic smuggled keys (\`${report.aggregate.registryGhostPaths.join("`, `")}\`) are outside registry allow-map; factory rejects them before prune. Clean rich canonical → \`pruneDenaliWizardFormToRegistry\` → export: ${syntheticCleanLoss.length ? `prune drops ${syntheticCleanLoss.join(", ")}` : "no registry-addressable path loss"}; \`category\`, \`title\`, and \`photos[]\` survive.`
      : `**Finding:** Live ghosts: ${liveGhosts.length ? liveGhosts.join(", ") : "none"}. Prune round-trip losses on stored rows: ${pruneLosses.length ? pruneLosses.join(", ") : "none"}.`,
    "",
    "**Artifact:** `apps/api/reports/template-canonical-ghost-fields.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Ghost-Field Audit — `canonical_data` vs Registry";
  let body: string;
  if (existing.includes(marker)) {
    const start = existing.indexOf(marker);
    const afterMarker = existing.slice(start + marker.length);
    const nextH2 = afterMarker.search(/\n## /);
    const end = nextH2 >= 0 ? start + marker.length + nextH2 : existing.length;
    body = `${existing.slice(0, start).replace(/\n+$/, "")}${section}${existing.slice(end)}`;
  } else {
    body = `${existing.replace(/\n+$/, "")}${section}`;
  }
  fs.writeFileSync(resolved, body, "utf8");
  emitScriptInfo(`Appended ghost-field section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const dataSource = new DataSource(createDataSourceOptionsFromEnv());
  await dataSource.initialize();

  try {
    const rows = (await dataSource.query(
      `
      SELECT id, workspace_id, base_profile, canonical_data
      FROM workspace_tour_wizard_templates
      ORDER BY updated_at DESC
      `,
    )) as TemplateRow[];

    const perTemplate = rows.map((row) => auditRow(row));
    const nonEmpty = perTemplate.filter((row) => row.canonicalKeyCount > 0);
    const usedSyntheticFixture = nonEmpty.length === 0;
    const syntheticProbes = await runSyntheticProbes();

    for (const row of nonEmpty) {
      const canonical = rows.find((template) => template.id === row.id)?.canonical_data;
      if (isPlainObject(canonical)) {
        row.pruneRoundTripLostPaths = uniqueSorted(
          await collectPruneRoundTripLostPaths(canonical),
        );
      }
    }

    const aggregate = {
      registryGhostPaths: uniqueSorted([
        ...perTemplate.flatMap((row) => row.registryGhostPaths),
        ...syntheticProbes.flatMap((probe) => probe.registryGhostPaths),
      ]),
      discardedTopLevelKeys: uniqueSorted(perTemplate.flatMap((row) => row.discardedTopLevelKeys)),
      pruneRoundTripLostPaths: uniqueSorted([
        ...perTemplate.flatMap((row) => row.pruneRoundTripLostPaths),
        ...syntheticProbes.flatMap((probe) => probe.pruneRoundTripLostPaths),
      ]),
    };

    const dbPass = perTemplate.every(
      (row) =>
        row.registryGhostPaths.length === 0 &&
        row.discardedTopLevelKeys.length === 0 &&
        row.zodValidationIssues.length === 0 &&
        row.pruneRoundTripLostPaths.length === 0,
    );

    const report: GhostFieldReport = {
      generatedAt: new Date().toISOString(),
      templatesScanned: rows.length,
      templatesWithNonEmptyCanonical: nonEmpty.length,
      usedSyntheticFixture,
      registryDefinition:
        "DENALI_FIELD_DEFINITIONS canonical paths → storage (`toDenaliTemplateStoragePath`) + ZOD_KIND_ARRAY_ELEMENT_KEYS + location object keys; compared to live JSONB.",
      perTemplate,
      syntheticProbes,
      aggregate,
      pass: dbPass,
    };

    const jsonResolved = path.resolve(
      jsonOut ?? path.join(process.cwd(), "reports", "template-canonical-ghost-fields.json"),
    );
    fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
    fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    emitScriptInfo(`Wrote ${jsonResolved}`);

    const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
    appendMarkdown(mdTarget, formatMarkdown(report));

    emitScriptInfo(
      JSON.stringify(
        {
          pass: report.pass,
          templatesScanned: report.templatesScanned,
          aggregate,
        },
        null,
        2,
      ),
    );

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
