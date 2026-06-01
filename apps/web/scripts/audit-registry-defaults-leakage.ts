/**
 * Registry-defaults leakage audit: old/sparse template canonical vs current
 * {@link orchestrateDenaliWizardFromTemplate} / DenaliTemplateOrchestratorFactory.
 *
 * Simulates registry growth (new mandatory RHF paths) and stale form/default pollution.
 *
 * Usage:
 *   pnpm --filter web audit:registry-defaults-leakage
 *   pnpm --filter web audit:registry-defaults-leakage -- --markdown-out=../../audit-report.md
 */
import fs from "node:fs";
import path from "node:path";

import { DENALI_ROOTS } from "@repo/shared-contracts";
import {
  DENALI_FIELD_DEFINITIONS,
  denaliTemplateOrchestratorFactory,
  getDenaliFormPathValue,
  pruneDenaliWizardFormToRegistry,
  resetWizardToRegistryDefaults,
} from "@repo/denali-domain";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import type { DenaliZodFieldKind } from "@repo/denali-domain";

import { orchestrateDenaliWizardFromTemplate } from "../src/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import type { TenantWizardTemplate } from "../src/features/tours/wizard/template/tenant-wizard-template.types";

const GHOST_KEY = "__registryLeakageGhostMandatory__";
const OLD_TEMPLATE_TITLE = "__OLD_REGISTRY_TEMPLATE_TITLE__";
const WORKSPACE = "ws-registry-leakage-audit";
const TEMPLATE_ID = "tpl-registry-leakage-audit";

/** Paths representing fields added to the registry after a sparse legacy template was saved. */
const REGISTRY_ARRAY_ELEMENT_KEYS: Partial<
  Record<DenaliZodFieldKind, readonly string[]>
> = {
  gatheringPoints: ["id", "title", "time", "location"],
  itinerary: ["day", "title", "description", "location", "locationText", "activities", "photos"],
  gearItems: ["id", "name", "required"],
  photos: ["id", "assetId", "url", "filename", "size", "mimeType", "uploadedAt", "uploadStatus"],
};

const SYNTHETIC_NEW_REGISTRY_PATHS = [
  "photosData.photos",
  "tripDetails.logistics.gatheringPoints",
  "tripDetails.metrics.elevationGain",
  "participantRequirements.gearItems",
  "programNature.itinerary",
] as const;

type ScenarioResult = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

type RegistryLeakageReport = {
  generatedAt: string;
  entrypoint: string;
  pipeline: string;
  registryRhfPathCount: number;
  scenarios: ScenarioResult[];
  newFieldProbe: {
    paths: readonly string[];
    allMatchFreshDefaults: boolean;
    perPath: Record<string, boolean>;
  };
  ghostProbe: {
    ghostInDefaultsInjected: boolean;
    ghostInOrchestratedForm: boolean;
    ghostAfterManualPrune: boolean;
  };
  summary: { pass: boolean };
};

function parseArgs(argv: string[]): { markdownOut: string | null; jsonOut: string | null } {
  const markdownOutArg = argv.find((arg) => arg.startsWith("--markdown-out="));
  const jsonOutArg = argv.find((arg) => arg.startsWith("--json-out="));
  return {
    markdownOut: markdownOutArg ? markdownOutArg.slice("--markdown-out=".length) : null,
    jsonOutArg: jsonOutArg ? jsonOutArg.slice("--json-out=".length) : null,
  };
}

function uniqueRegistryRhfPaths(): readonly string[] {
  return [...new Set(DENALI_FIELD_DEFINITIONS.map((field) => field.rhfPath))];
}

function auditTemplate(canonicalData: Record<string, unknown>): TenantWizardTemplate {
  return {
    id: TEMPLATE_ID,
    workspaceId: WORKSPACE,
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData,
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function buildSparseLegacyCanonical(): DenaliCanonicalTemplateData {
  return {
    category: "mountain",
    duration: "single",
    title: OLD_TEMPLATE_TITLE,
    program: { shortDescription: "Legacy short", themeIds: [] },
    transport: { mode: "none" },
    pricing: { paymentMode: "offline_receipt", requiresPayment: false },
    participants: {},
    policies: { policiesText: "" },
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function formTopLevelKeys(form: Record<string, unknown>): string[] {
  return Object.keys(form).filter((key) => (form as Record<string, unknown>)[key] !== undefined);
}

function buildRegistryAllowedChildKeys(): Map<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();
  const add = (prefix: string, segment: string): void => {
    let bucket = map.get(prefix);
    if (!bucket) {
      bucket = new Set<string>();
      map.set(prefix, bucket);
    }
    bucket.add(segment);
  };

  for (const rhfPath of uniqueRegistryRhfPaths()) {
    const segments = rhfPath.split(".").filter((segment) => segment.length > 0);
    for (let index = 0; index < segments.length; index += 1) {
      add(segments.slice(0, index).join("."), segments[index]!);
    }
  }

  for (const field of DENALI_FIELD_DEFINITIONS) {
    const elementKeys = REGISTRY_ARRAY_ELEMENT_KEYS[field.zodKind];
    if (!elementKeys) {
      continue;
    }
    for (const key of elementKeys) {
      add(field.rhfPath, key);
      if (key === "location") {
        for (const locKey of ["id", "addressText", "latitude", "longitude"]) {
          add(`${field.rhfPath}.location`, locKey);
        }
      }
    }
  }

  const rootKeys = map.get("") ?? new Set<string>();
  for (const root of DENALI_ROOTS) {
    rootKeys.add(root);
  }
  map.set("", rootKeys);

  const frozen = new Map<string, ReadonlySet<string>>();
  for (const [prefix, keys] of map) {
    frozen.set(prefix, keys);
  }
  return frozen;
}

const REGISTRY_ALLOWED = buildRegistryAllowedChildKeys();

function collectGhostKeys(value: unknown, prefix = ""): string[] {
  const ghosts: string[] = [];
  if (value == null || typeof value !== "object") {
    return ghosts;
  }

  if (Array.isArray(value)) {
    const parentPath = prefix;
    const zodKind = DENALI_FIELD_DEFINITIONS.find((field) => field.rhfPath === parentPath)?.zodKind;
    const elementKeys = zodKind ? REGISTRY_ARRAY_ELEMENT_KEYS[zodKind] : undefined;
    if (elementKeys) {
      for (let index = 0; index < value.length; index += 1) {
        const row = value[index];
        if (row != null && typeof row === "object" && !Array.isArray(row)) {
          for (const key of Object.keys(row as Record<string, unknown>)) {
            if (!elementKeys.includes(key as never)) {
              ghosts.push(`${parentPath}[${index}].${key}`);
            }
          }
        }
      }
    }
    return ghosts;
  }

  const allowed = REGISTRY_ALLOWED.get(prefix) ?? new Set<string>();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      ghosts.push(prefix ? `${prefix}.${key}` : key);
      continue;
    }
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    ghosts.push(...collectGhostKeys(child, childPrefix));
  }

  return ghosts;
}

function injectGhostIntoDefaults(): ReturnType<typeof resetWizardToRegistryDefaults> {
  const defaults = resetWizardToRegistryDefaults();
  const tripDetails = defaults.tripDetails ?? {
    logistics: { gatheringPoints: [] },
    overview: { customServiceLabels: [] },
    metrics: {},
  };
  return {
    ...defaults,
    tripDetails: {
      ...tripDetails,
      [GHOST_KEY]: "stale-mandatory-sim",
    } as typeof tripDetails,
  };
}

function hasGhostKey(value: unknown): boolean {
  if (value == null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasGhostKey(entry));
  }
  if (Object.prototype.hasOwnProperty.call(value, GHOST_KEY)) {
    return true;
  }
  return Object.values(value as Record<string, unknown>).some((child) => hasGhostKey(child));
}

async function probeNewRegistryPaths(
  form: Record<string, unknown>,
): Promise<RegistryLeakageReport["newFieldProbe"]> {
  const fresh = resetWizardToRegistryDefaults();
  const perPath: Record<string, boolean> = {};

  for (const rhfPath of SYNTHETIC_NEW_REGISTRY_PATHS) {
    const hydrated = getDenaliFormPathValue(form, rhfPath);
    const baseline = getDenaliFormPathValue(fresh, rhfPath);
    perPath[rhfPath] = stableJson(hydrated) === stableJson(baseline);
  }

  return {
    paths: SYNTHETIC_NEW_REGISTRY_PATHS,
    allMatchFreshDefaults: Object.values(perPath).every(Boolean),
    perPath,
  };
}

async function runScenarios(): Promise<{
  scenarios: ScenarioResult[];
  newFieldProbe: RegistryLeakageReport["newFieldProbe"];
  ghostProbe: RegistryLeakageReport["ghostProbe"];
}> {
  const scenarios: ScenarioResult[] = [];
  const freshDefaults = resetWizardToRegistryDefaults();
  const sparseCanonical = buildSparseLegacyCanonical();

  const emptyResult = await orchestrateDenaliWizardFromTemplate(auditTemplate({}), {});
  const emptyForm = emptyResult.success ? (emptyResult.form as Record<string, unknown>) : null;
  const emptyGhosts = emptyForm ? collectGhostKeys(emptyForm) : ["orchestration_failed"];
  scenarios.push({
    id: "empty_canonical_registry_shell",
    label: "Empty {} canonical → registry default shell (no stale merge)",
    pass:
      emptyResult.success === true &&
      emptyGhosts.length === 0 &&
      stableJson(formTopLevelKeys(emptyForm!)) === stableJson(formTopLevelKeys(freshDefaults as Record<string, unknown>)),
    detail: emptyResult.success
      ? `roots=${formTopLevelKeys(emptyForm!).join(",")}; ghosts=${emptyGhosts.length}`
      : emptyResult.errors?.join("; ") ?? "failed",
  });

  const sparseResult = await orchestrateDenaliWizardFromTemplate(
    auditTemplate(sparseCanonical as Record<string, unknown>),
    sparseCanonical as Record<string, unknown>,
  );
  const sparseForm = sparseResult.success ? (sparseResult.form as Record<string, unknown>) : null;
  const sparseTitle =
    sparseForm != null
      ? (sparseForm.basicInfo as Record<string, unknown> | undefined)?.title
      : undefined;
  const sparseGhosts = sparseForm ? collectGhostKeys(sparseForm) : ["orchestration_failed"];
  scenarios.push({
    id: "sparse_legacy_merge",
    label: "Sparse legacy canonical merges onto defaults (title preserved, no ghosts)",
    pass:
      sparseResult.success === true &&
      sparseTitle === OLD_TEMPLATE_TITLE &&
      sparseGhosts.length === 0,
    detail: sparseResult.success
      ? `title=${String(sparseTitle)}; ghosts=${sparseGhosts.join(",") || "—"}`
      : sparseResult.errors?.join("; ") ?? "failed",
  });

  const newFieldProbe = sparseForm
    ? await probeNewRegistryPaths(sparseForm)
    : {
        paths: SYNTHETIC_NEW_REGISTRY_PATHS,
        allMatchFreshDefaults: false,
        perPath: Object.fromEntries(SYNTHETIC_NEW_REGISTRY_PATHS.map((path) => [path, false])),
      };

  scenarios.push({
    id: "synthetic_new_registry_paths",
    label: "New registry paths absent in old canonical receive fresh defaults",
    pass: newFieldProbe.allMatchFreshDefaults,
    detail: Object.entries(newFieldProbe.perPath)
      .map(([path, ok]) => `${path}=${ok ? "default" : "DIFF"}`)
      .join("; "),
  });

  const pollutedDefaults = injectGhostIntoDefaults();
  const factoryWithStaleDefaults = await denaliTemplateOrchestratorFactory.createDraftFromTemplate(
    {
      workspaceId: WORKSPACE,
      templateId: TEMPLATE_ID,
      canonicalData: sparseCanonical as Record<string, unknown>,
      fieldRulesOverlay: {},
    },
    { defaultValues: pollutedDefaults },
  );
  const staleForm =
    factoryWithStaleDefaults.success &&
    factoryWithStaleDefaults.draftState.data?.form != null &&
    typeof factoryWithStaleDefaults.draftState.data.form === "object"
      ? (factoryWithStaleDefaults.draftState.data.form as Record<string, unknown>)
      : null;
  const ghostProbe: RegistryLeakageReport["ghostProbe"] = {
    ghostInDefaultsInjected: hasGhostKey(pollutedDefaults),
    ghostInOrchestratedForm: staleForm ? hasGhostKey(staleForm) : true,
    ghostAfterManualPrune: staleForm ? hasGhostKey(pruneDenaliWizardFormToRegistry(staleForm as never)) : true,
  };

  scenarios.push({
    id: "stale_defaultValues_pruned",
    label: "Stale keys injected via defaultValues are stripped by prune (not merged forward)",
    pass:
      factoryWithStaleDefaults.success === true &&
      ghostProbe.ghostInDefaultsInjected &&
      !ghostProbe.ghostInOrchestratedForm &&
      !ghostProbe.ghostAfterManualPrune,
    detail: `ghost in defaults=${ghostProbe.ghostInDefaultsInjected}; in orchestrated=${ghostProbe.ghostInOrchestratedForm}; after prune=${ghostProbe.ghostAfterManualPrune}`,
  });

  const fossilResult = await orchestrateDenaliWizardFromTemplate(
    auditTemplate({ title: "x", tripDetails: { rogue: true } } as Record<string, unknown>),
    { title: "x", tripDetails: { rogue: true } },
  );
  scenarios.push({
    id: "fossil_canonical_rejected",
    label: "Fossil canonical keys fail resolve before hydration (no stale JSON merge)",
    pass: fossilResult.success === false,
    detail: fossilResult.errors?.join("; ") ?? "unexpected success",
  });

  function countDefinedRegistryPaths(form: Record<string, unknown>): number {
    let count = 0;
    for (const path of uniqueRegistryRhfPaths()) {
      if (getDenaliFormPathValue(form, path) !== undefined) {
        count += 1;
      }
    }
    return count;
  }

  const prunedFresh = pruneDenaliWizardFormToRegistry(
    resetWizardToRegistryDefaults() as never,
  ) as Record<string, unknown>;
  const sparseDefinedPaths = sparseForm ? countDefinedRegistryPaths(sparseForm) : 0;
  const freshDefinedPaths = countDefinedRegistryPaths(prunedFresh);
  const rootsMatch =
    sparseForm != null &&
    stableJson(formTopLevelKeys(sparseForm).sort()) ===
      stableJson([...DENALI_ROOTS].sort());

  scenarios.push({
    id: "prune_registry_shell",
    label: "Hydrated output is registry-pruned shell (DENALI_ROOTS only, no extra top-level keys)",
    pass: sparseResult.success === true && rootsMatch,
    detail: sparseForm ? `roots=${formTopLevelKeys(sparseForm).join(",")}` : "no form",
  });

  scenarios.push({
    id: "defined_paths_backfill_not_shrink",
    label: "Legacy template hydration defines ≥ fresh prune paths (registry backfill, not stale shrink)",
    pass:
      sparseResult.success === true &&
      sparseDefinedPaths >= freshDefinedPaths &&
      freshDefinedPaths > 0,
    detail: `sparse=${sparseDefinedPaths}, freshPrune=${freshDefinedPaths} of ${uniqueRegistryRhfPaths().length} registry paths`,
  });

  return { scenarios, newFieldProbe, ghostProbe };
}

function formatMarkdown(report: RegistryLeakageReport): string {
  const lines = [
    "",
    "---",
    "",
    "## Registry-Defaults Leakage Audit — `orchestrateDenaliWizardFromTemplate` (2026-06-01)",
    "",
    `**Procedure:** \`pnpm --filter web audit:registry-defaults-leakage\` (\`apps/web/scripts/audit-registry-defaults-leakage.ts\`)`,
    "",
    `**Generated:** ${report.generatedAt}`,
    "",
    `**Entrypoint:** \`${report.entrypoint}\``,
    "",
    `**Pipeline:** ${report.pipeline}`,
    "",
    `**Registry RHF paths:** ${report.registryRhfPathCount}`,
    "",
    "### Scenarios",
    "",
    "| Scenario | Pass | Detail |",
    "|----------|------|--------|",
  ];

  for (const row of report.scenarios) {
    lines.push(`| ${row.label} | ${row.pass ? "**yes**" : "**no**"} | ${row.detail} |`);
  }

  lines.push(
    "",
    "### Synthetic new-registry paths (absent in sparse legacy canonical)",
    "",
    `All match \`resetWizardToRegistryDefaults()\`: **${report.newFieldProbe.allMatchFreshDefaults ? "yes" : "no"}**`,
    "",
    "| Path | Matches fresh default |",
    "|------|----------------------|",
  );

  for (const [path, ok] of Object.entries(report.newFieldProbe.perPath)) {
    lines.push(`| \`${path}\` | ${ok ? "yes" : "**no**"} |`);
  }

  lines.push(
    "",
    "### Stale `defaultValues` ghost probe",
    "",
    `Ghost injected in defaults: **${report.ghostProbe.ghostInDefaultsInjected ? "yes" : "no"}**`,
    "",
    `Ghost survives orchestration: **${report.ghostProbe.ghostInOrchestratedForm ? "yes (FAIL)" : "no"}**`,
    "",
    `Ghost after manual prune: **${report.ghostProbe.ghostAfterManualPrune ? "yes (FAIL)" : "no"}**`,
    "",
    "### Verdict",
    "",
    report.summary.pass
      ? "**PASS:** Old/sparse templates hydrate via `resetWizardToRegistryDefaults()` → canonical merge → `denaliCanonicalToForm(existingForm)` → prune. New registry fields receive current defaults; stale non-registry keys are not carried forward. Empty canonical yields a registry-default shell, not a stale JSON merge."
      : "**FAIL:** Registry-default leakage or stale-key merge detected — hydrated form diverges from expected default backfill or retains ghost keys.",
    "",
    "**Artifact:** `apps/web/reports/registry-defaults-leakage.json`",
    "",
  );

  return lines.join("\n");
}

function appendMarkdown(markdownOut: string, section: string): void {
  const resolved = path.resolve(markdownOut);
  const existing = fs.existsSync(resolved) ? fs.readFileSync(resolved, "utf8") : "";
  const marker = "## Registry-Defaults Leakage Audit — `orchestrateDenaliWizardFromTemplate`";
  const trimmed = existing.includes(marker)
    ? existing.slice(0, existing.indexOf(marker)).replace(/\n+$/, "")
    : existing.replace(/\n+$/, "");
  fs.writeFileSync(resolved, `${trimmed}${section}`, "utf8");
  console.log(`Appended registry-leakage section to ${resolved}`);
}

async function main(): Promise<void> {
  const { markdownOut, jsonOut } = parseArgs(process.argv.slice(2));
  const { scenarios, newFieldProbe, ghostProbe } = await runScenarios();

  const report: RegistryLeakageReport = {
    generatedAt: new Date().toISOString(),
    entrypoint: "orchestrateDenaliWizardFromTemplate → denaliTemplateOrchestratorFactory.createDraftFromTemplate",
    pipeline:
      "resolveStoredTemplateCanonical → tryHydrateCanonicalTemplate( patch, resetWizardToRegistryDefaults() ) → denaliCanonicalToForm(merged, existingForm) → normalize → finalize → pruneDenaliWizardFormToRegistry",
    registryRhfPathCount: uniqueRegistryRhfPaths().length,
    scenarios,
    newFieldProbe,
    ghostProbe,
    summary: {
      pass: scenarios.every((row) => row.pass) && newFieldProbe.allMatchFreshDefaults,
    },
  };

  const jsonResolved = path.resolve(
    jsonOut ?? path.join(process.cwd(), "reports", "registry-defaults-leakage.json"),
  );
  fs.mkdirSync(path.dirname(jsonResolved), { recursive: true });
  fs.writeFileSync(jsonResolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${jsonResolved}`);

  const mdTarget = markdownOut ?? path.resolve(process.cwd(), "../../audit-report.md");
  appendMarkdown(mdTarget, formatMarkdown(report));

  console.log(JSON.stringify(report.summary, null, 2));

  if (!report.summary.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
