#!/usr/bin/env node
/**
 * run-denali-field-update.ts
 * ---------------------------------------------------------------------------
 * Denali Wizard — CI/CD field add/remove pipeline (single entry point).
 *
 * Reads a YAML or JSON manifest of wizard fields and:
 *   1. Resolves each field to canonical / RHF / rule / projection layers
 *   2. Idempotently syncs managed registry blocks in source files
 *   3. Verifies Canonical, Rules, Normalization, UI Sync, Projection
 *   4. Runs existing gate scripts + Unit + E2E tests (fails on any error)
 *
 * Usage (from repository root):
 *   node packages/ci-templates/denali-wizard/run-denali-field-update.ts
 *   node packages/ci-templates/denali-wizard/run-denali-field-update.ts --fields=./my-fields.json
 *   node packages/ci-templates/denali-wizard/run-denali-field-update.ts --fields=./my-fields.yaml --dry-run
 *   node packages/ci-templates/denali-wizard/run-denali-field-update.ts --prune
 *
 * Flags:
 *   --fields=<path>   JSON or YAML manifest (default: embedded example below)
 *   --dry-run         Log planned writes; do not modify files
 *   --prune           Remove canonical paths not listed in manifest (registry only)
 *   --skip-tests      Run gates only (no pnpm test / E2E)
 *   --log=<path>      Append log (default: map.log at repo root)
 *
 * Manifest shape:
 *   fields:
 *     - name: title
 *       tab: Basic Info          # Basic Info | Program | Transport | Pricing | Participants | Policies
 *       type: string             # string | number | enum | boolean
 *       required: true
 *       read-only: false
 *       conditional: null        # optional expression string (documented; not auto-wired)
 *       default: null            # optional default (documented)
 *
 * Idempotency: re-running with the same manifest produces identical managed blocks
 * and skips file writes when content is unchanged.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Embedded example manifest (matches product checklist in map.md)
// ---------------------------------------------------------------------------
const DEFAULT_MANIFEST_YAML = `
fields:
  - name: title
    tab: Basic Info
    type: string
    required: true
    read-only: false
  - name: tourType
    tab: Basic Info
    type: enum
    required: true
    read-only: false
  - name: destinationId
    tab: Basic Info
    type: string
    required: true
    read-only: false
  - name: maximumAge
    tab: Participants
    type: number
    required: false
    read-only: false
`.trim();

// ---------------------------------------------------------------------------
// Repository paths (relative to cwd = repo root)
// ---------------------------------------------------------------------------
const REPO_ROOT = process.cwd();
const TEMPLATES_DIR = "packages/ci-templates/denali-wizard";
const LOG_FILE_DEFAULT = "map.log";

const PATHS = {
  canonicalModel: "packages/types/src/denali/denaliCanonicalTourModel.ts",
  canonicalFromForm: "packages/types/src/denali/denaliCanonicalFromForm.ts",
  ruleRequired: "apps/web/src/features/tours/wizard/denali/rules/denaliRuleRequired.ts",
  ruleModel: "apps/web/src/features/tours/wizard/denali/rules/denaliRuleModel.ts",
  formAdapter: "apps/web/src/features/tours/wizard/denali/denaliCanonicalFormAdapter.ts",
  ruleAccess: "apps/web/src/features/tours/wizard/denali/validation/denaliRuleAccess.ts",
  projection: "apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.ts",
  fieldMappingDoc: "docs/20-architecture/denali-wizard-field-mapping.md",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DenaliFieldType = "string" | "number" | "enum" | "boolean";

export type DenaliFieldSpec = {
  name: string;
  tab: string;
  type: DenaliFieldType;
  required: boolean;
  readOnly: boolean;
  conditional?: string | null;
  default?: unknown;
};

type Manifest = { fields: DenaliFieldSpec[] };

type TabConfig = {
  formSection: string;
  step: string;
};

const TAB_CONFIG: Record<string, TabConfig> = {
  "Basic Info": { formSection: "basicInfo", step: "denali_basic" },
  Program: { formSection: "programNature", step: "denali_program" },
  Transport: { formSection: "transport", step: "denali_transport" },
  Pricing: { formSection: "pricingPayment", step: "denali_pricing" },
  Participants: { formSection: "participantRequirements", step: "denali_pricing" },
  Policies: { formSection: "policies", step: "review" },
};

/**
 * Wizard field `name` → canonical dot-path + form leaf + projection hints.
 * Extend this table when adding new product fields to the manifest.
 */
const FIELD_REGISTRY: Record<
  string,
  {
    canonical: string;
    formLeaf?: string;
    canonicalInterfaceKey?: string;
    projectionNeedle?: string;
    adapterNeedle?: string;
    aliases?: string[];
  }
> = {
  title: {
    canonical: "title",
    formLeaf: "title",
    canonicalInterfaceKey: "title",
    projectionNeedle: "canonical.title",
    adapterNeedle: "title: canonical.title",
  },
  tourType: {
    canonical: "category",
    formLeaf: "tourType",
    canonicalInterfaceKey: "category",
    projectionNeedle: "canonical.category",
    adapterNeedle: "tourType:",
    aliases: ["category"],
  },
  destinationId: {
    canonical: "destinationId",
    formLeaf: "destinationId",
    projectionNeedle: "canonical.destinationId",
    adapterNeedle: "destinationId: canonical.destinationId",
  },
  startDateTime: {
    canonical: "startDateTime",
    formLeaf: "startDateTime",
    projectionNeedle: "canonical.startDateTime",
    adapterNeedle: "startDateTime: canonical.startDateTime",
  },
  endDateTime: {
    canonical: "endDateTime",
    formLeaf: "endDateTime",
    projectionNeedle: "canonical.endDateTime",
    adapterNeedle: "endDateTime: canonical.endDateTime",
  },
  capacityMin: {
    canonical: "capacityMin",
    formLeaf: "capacityMin",
    projectionNeedle: "canonical.capacityMin",
    adapterNeedle: "capacityMin: canonical.capacityMin",
  },
  capacityMax: {
    canonical: "capacityMax",
    formLeaf: "capacityMax",
    projectionNeedle: "canonical.capacityMax",
    adapterNeedle: "capacityMax: canonical.capacityMax",
  },
  meetingPoint: {
    canonical: "meetingPoint",
    formLeaf: "meetingPoint",
    projectionNeedle: "canonical.meetingPoint",
    adapterNeedle: "meetingPoint",
  },
  mainThemeId: {
    canonical: "program.mainThemeId",
    formLeaf: "mainTourThemeId",
    projectionNeedle: "canonical.program.mainThemeId",
    adapterNeedle: "mainTourThemeId",
  },
  shortDescription: {
    canonical: "program.shortDescription",
    formLeaf: "shortDescription",
    projectionNeedle: "canonical.program.shortDescription",
    adapterNeedle: "shortDescription",
  },
  longDescription: {
    canonical: "program.longDescription",
    formLeaf: "longDescription",
    adapterNeedle: "longDescription",
  },
  difficultyLevel: {
    canonical: "program.difficultyLevel",
    formLeaf: "difficultyLevel",
    adapterNeedle: "difficultyLevel",
  },
  hikingHoursApprox: {
    canonical: "program.hikingHoursApprox",
    formLeaf: "hikingHoursApprox",
    adapterNeedle: "hikingHoursApprox",
  },
  transportMode: {
    canonical: "transport.mode",
    formLeaf: "transportMode",
    projectionNeedle: "canonical.transport",
    adapterNeedle: "transportMode",
  },
  dongAmount: {
    canonical: "transport.dongAmount",
    formLeaf: "dongAmount",
    adapterNeedle: "dongAmount",
  },
  transportNotes: {
    canonical: "transport.transportNotes",
    formLeaf: "transportNotes",
    adapterNeedle: "transportNotes",
  },
  requiresPayment: {
    canonical: "pricing.requiresPayment",
    formLeaf: "requiresPayment",
    adapterNeedle: "requiresPayment",
  },
  basePricePerPerson: {
    canonical: "pricing.basePricePerPerson",
    formLeaf: "basePricePerPerson",
    adapterNeedle: "basePricePerPerson",
  },
  paymentMode: {
    canonical: "pricing.paymentMode",
    formLeaf: "paymentMode",
    adapterNeedle: "paymentMode",
  },
  minimumAge: {
    canonical: "participants.minimumAge",
    formLeaf: "minimumAge",
    projectionNeedle: "canonical.participants.minimumAge",
    adapterNeedle: "minimumAge: canonical.participants.minimumAge",
  },
  maximumAge: {
    canonical: "participants.maximumAge",
    formLeaf: "maximumAge",
    projectionNeedle: "canonical.participants.maximumAge",
    adapterNeedle: "maximumAge: canonical.participants.maximumAge",
  },
  fitnessLevel: {
    canonical: "participants.fitnessLevel",
    formLeaf: "fitnessLevel",
    adapterNeedle: "fitnessLevel",
  },
  sportsInsuranceRequired: {
    canonical: "participants.sportsInsuranceRequired",
    formLeaf: "sportsInsuranceRequired",
    adapterNeedle: "sportsInsuranceRequired",
  },
  cancellationPolicy: {
    canonical: "policies.cancellationPolicy",
    formLeaf: "cancellationPolicy",
    adapterNeedle: "cancellationPolicy",
  },
  policiesText: {
    canonical: "policies.policiesText",
    formLeaf: "cancellationPolicy",
    adapterNeedle: "policiesText",
  },
};

export type ResolvedField = DenaliFieldSpec & {
  canonical: string;
  formPath: string;
  step: string;
  registryKnown: boolean;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
type CliOptions = {
  fieldsPath?: string;
  dryRun: boolean;
  prune: boolean;
  skipTests: boolean;
  logFile: string;
};

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    prune: false,
    skipTests: false,
    logFile: LOG_FILE_DEFAULT,
  };
  for (const arg of argv) {
    if (arg.startsWith("--fields=")) opts.fieldsPath = arg.slice("--fields=".length);
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--prune") opts.prune = true;
    else if (arg === "--skip-tests") opts.skipTests = true;
    else if (arg.startsWith("--log=")) opts.logFile = arg.slice("--log=".length);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
let logStream: string[] = [];

function log(tag: string, message: string): void {
  const line = `[${tag}] ${message}`;
  logStream.push(line);
}

function flushLog(logFile: string): void {
  const header = `\n--- Denali field update ${new Date().toString()} ---\n`;
  fs.appendFileSync(path.join(REPO_ROOT, logFile), header + logStream.join("\n") + "\n");
}

function fail(tag: string, message: string): never {
  log(tag, `ERROR: ${message}`);
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Manifest parsing (JSON + minimal YAML for `fields:` lists)
// ---------------------------------------------------------------------------
function parseSimpleYamlFields(text: string): Manifest {
  const fields: DenaliFieldSpec[] = [];
  const lines = text.split(/\r?\n/);
  let current: Partial<DenaliFieldSpec> | null = null;
  let inFields = false;

  const set = (key: string, raw: string) => {
    if (!current) return;
    const v = raw.trim().replace(/^["']|["']$/g, "");
    switch (key) {
      case "name":
        current.name = v;
        break;
      case "tab":
        current.tab = v;
        break;
      case "type":
        current.type = v as DenaliFieldType;
        break;
      case "required":
        current.required = v === "true";
        break;
      case "read-only":
      case "readOnly":
        current.readOnly = v === "true";
        break;
      case "conditional":
        current.conditional = v === "null" ? null : v;
        break;
      case "default":
        current.default = v === "null" ? null : v;
        break;
      default:
        break;
    }
  };

  for (const line of lines) {
    if (/^fields:\s*$/.test(line)) {
      inFields = true;
      continue;
    }
    if (!inFields) continue;
    const item = line.match(/^\s*-\s*$/);
    const kv = line.match(/^\s+([a-zA-Z-]+):\s*(.*)$/);
    if (line.match(/^\s*-\s*name:/)) {
      if (current?.name) fields.push(current as DenaliFieldSpec);
      const name = line.replace(/^\s*-\s*name:\s*/, "").trim();
      current = { name, tab: "", type: "string", required: false, readOnly: false };
      continue;
    }
    if (item && current?.name) {
      fields.push(current as DenaliFieldSpec);
      current = { name: "", tab: "", type: "string", required: false, readOnly: false };
      continue;
    }
    if (kv && current) set(kv[1], kv[2]);
  }
  if (current?.name) fields.push(current as DenaliFieldSpec);
  return { fields };
}

function loadManifest(fieldsPath?: string): Manifest {
  const raw = fieldsPath
    ? fs.readFileSync(path.resolve(REPO_ROOT, fieldsPath), "utf-8")
    : DEFAULT_MANIFEST_YAML;
  const trimmed = raw.trim();
  if (fieldsPath?.endsWith(".json") || trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as Manifest;
  }
  return parseSimpleYamlFields(raw);
}

// ---------------------------------------------------------------------------
// Field resolution
// ---------------------------------------------------------------------------
function resolveField(spec: DenaliFieldSpec): ResolvedField {
  if (!TAB_CONFIG[spec.tab]) {
    fail("Manifest", `Unknown tab "${spec.tab}" on field "${spec.name}". Use: ${Object.keys(TAB_CONFIG).join(", ")}`);
  }
  const tab = TAB_CONFIG[spec.tab];
  const reg = FIELD_REGISTRY[spec.name];
  const canonical = reg?.canonical ?? spec.name;
  const formLeaf = reg?.formLeaf ?? spec.name;
  const formPath = `${tab.formSection}.${formLeaf}`;
  return {
    ...spec,
    canonical,
    formPath,
    step: tab.step,
    registryKnown: reg != null,
  };
}

function readExistingCanonicalPaths(filePath: string): string[] {
  const content = fs.readFileSync(path.join(REPO_ROOT, filePath), "utf-8");
  const m = content.match(/DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set\(\[([\s\S]*?)\]\)/);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function buildCanonicalPathSet(fields: ResolvedField[], prune: boolean, existing: string[]): string[] {
  const fromManifest = fields.map((f) => f.canonical);
  const merged = prune ? fromManifest : [...new Set([...existing, ...fromManifest])];
  return merged.sort();
}

function _buildFormPathMapEntries(fields: ResolvedField[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.canonical)) continue;
    seen.add(f.canonical);
    lines.push(`  "${f.canonical}": "${f.formPath}",`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Idempotent file patching
// ---------------------------------------------------------------------------
function syncCanonicalFieldPathsSet(
  paths: string[],
  dryRun: boolean,
): { changed: boolean; content: string } {
  const filePath = path.join(REPO_ROOT, PATHS.ruleRequired);
  let content = fs.readFileSync(filePath, "utf-8");
  const body = paths.map((p) => `  "${p}",`).join("\n");
  const nextBlock = `export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set([\n${body}\n]);`;
  const pattern = /export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set\(\[[\s\S]*?\]\);/;
  if (!pattern.test(content)) fail("Patch", "DENALI_WIZARD_CANONICAL_FIELD_PATHS block missing");
  const next = content.replace(pattern, nextBlock);
  const changed = next !== content;
  if (changed && !dryRun) fs.writeFileSync(filePath, next, "utf-8");
  return { changed, content: next };
}

function syncCanonicalToFormMap(
  fields: ResolvedField[],
  dryRun: boolean,
): { changed: boolean } {
  const filePath = path.join(REPO_ROOT, PATHS.ruleRequired);
  let content = fs.readFileSync(filePath, "utf-8");
  const existing = content.match(
    /const CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = \{([\s\S]*?)\};/,
  );
  if (!existing) fail("Patch", "CANONICAL_TO_FORM_PATH_MAP block missing");

  const mapBody = existing[1];
  const mapEntries = new Map<string, string>();
  for (const m of mapBody.matchAll(/"([^"]+)":\s*"([^"]+)",/g)) {
    mapEntries.set(m[1], m[2]);
  }
  for (const f of fields) {
    mapEntries.set(f.canonical, f.formPath);
  }
  const sortedKeys = [...mapEntries.keys()].sort();
  const newBody = sortedKeys.map((k) => `  "${k}": "${mapEntries.get(k)}",`).join("\n");
  const nextMap = `const CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = {\n${newBody}\n};`;
  const next = content.replace(
    /const CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = \{[\s\S]*?\};/,
    nextMap,
  );
  const changed = next !== content;
  if (changed && !dryRun) fs.writeFileSync(filePath, next, "utf-8");
  return { changed };
}

// ---------------------------------------------------------------------------
// Layer verification (read-only checks; logs warnings for manual follow-up)
// ---------------------------------------------------------------------------
function readRepoFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf-8");
}

function verifyCanonicalModel(fields: ResolvedField[]): boolean {
  log("Canonical", "Verifying DenaliCanonicalTourModel + denaliCanonicalFromForm...");
  const model = readRepoFile(PATHS.canonicalModel);
  const fromForm = readRepoFile(PATHS.canonicalFromForm);
  let ok = true;
  for (const f of fields) {
    const key = FIELD_REGISTRY[f.name]?.canonicalInterfaceKey ?? f.canonical.split(".").pop() ?? f.name;
    const topLevel = !f.canonical.includes(".");
    if (topLevel) {
      if (!new RegExp(`\\b${key}\\b`).test(model)) {
        log("Canonical", `Warning: top-level "${key}" not found in interface (field "${f.name}")`);
        ok = false;
      }
    } else {
      const [section, leaf] = f.canonical.split(".");
      if (!model.includes(`${section}:`) || !model.includes(`${leaf}`)) {
        log("Canonical", `Warning: nested "${f.canonical}" may be missing in interface`);
        ok = false;
      }
    }
    if (FIELD_REGISTRY[f.name]?.adapterNeedle && !fromForm.includes(f.canonical.split(".").pop()!)) {
      // soft check on fromForm mapping
    }
  }
  return ok;
}

function verifyRules(fields: ResolvedField[]): boolean {
  log("Rules", "Verifying denaliRuleModel path definitions...");
  const model = readRepoFile(PATHS.ruleModel);
  let ok = true;
  for (const f of fields) {
    const needle = `path: "${f.canonical}"`;
    if (!model.includes(needle)) {
      log(
        "Rules",
        `Warning: ${needle} not in denaliRuleModel — add a DenaliRuleFieldDefinition constant and include it in denaliRuleSet spreads (field "${f.name}").`,
      );
      ok = false;
    }
  }
  return ok;
}

function verifyNormalization(fields: ResolvedField[]): boolean {
  log("Normalization", "Verifying ghost-field registry drives normalizeDenaliWizardForm...");
  const access = readRepoFile(PATHS.ruleAccess);
  let ok = true;
  if (!access.includes("export function normalizeDenaliWizardForm")) {
    fail("Normalization", "normalizeDenaliWizardForm missing");
  }
  if (!access.includes("DENALI_WIZARD_CANONICAL_FIELD_PATHS")) {
    log("Normalization", "Warning: rule access should iterate DENALI_WIZARD_CANONICAL_FIELD_PATHS");
    ok = false;
  }
  for (const f of fields) {
    if (!access.includes(f.canonical) && !access.includes(f.formPath)) {
      log("Normalization", `Info: "${f.name}" relies on generic path clearing via canonical set`);
    }
  }
  return ok;
}

function verifyUiSync(fields: ResolvedField[]): boolean {
  log("UI Sync", "Verifying applyCanonicalMvpToForm / denaliCanonicalToForm...");
  const adapter = readRepoFile(PATHS.formAdapter);
  let ok = true;
  if (!adapter.includes("export function applyCanonicalMvpToForm")) {
    fail("UI Sync", "applyCanonicalMvpToForm missing");
  }
  for (const f of fields) {
    const needle = FIELD_REGISTRY[f.name]?.adapterNeedle ?? f.formPath.split(".")[1];
    if (needle && !adapter.includes(needle)) {
      log("UI Sync", `Warning: adapter may not sync "${f.name}" (look for "${needle}")`);
      ok = false;
    }
  }
  return ok;
}

function verifyProjection(fields: ResolvedField[]): boolean {
  log("Projection", "Verifying buildDenaliCreateTourPayloadProjection...");
  const proj = readRepoFile(PATHS.projection);
  let ok = true;
  if (!proj.includes("export function buildDenaliCreateTourPayloadProjection")) {
    fail("Projection", "projection function missing");
  }
  if (!proj.includes("const tripDetails = {")) {
    log("Projection", "Warning: tripDetails builder block not found");
    ok = false;
  }
  for (const f of fields) {
    const needle = FIELD_REGISTRY[f.name]?.projectionNeedle;
    if (needle && !proj.includes(needle)) {
      log("Projection", `Warning: projection may not map "${f.name}" (expected ref "${needle}")`);
      ok = false;
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Run existing gates + tests
// ---------------------------------------------------------------------------
function runNodeGate(scriptName: string): void {
  const script = path.join(REPO_ROOT, TEMPLATES_DIR, scriptName);
  log("Gate", `Running ${scriptName}...`);
  const r = spawnSync("node", [script], { cwd: REPO_ROOT, encoding: "utf-8" });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) fail("Gate", `${scriptName} exited with code ${r.status}`);
}

function runUnitTests(): void {
  log("Test", "Running apps/web unit tests (pnpm test)...");
  const r = spawnSync("pnpm", ["test"], { cwd: path.join(REPO_ROOT, "apps/web"), encoding: "utf-8", shell: true });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) fail("Test", `Unit tests failed (exit ${r.status})`);
}

function runE2ETests(): void {
  log("Test", "Running Denali negative invariant E2E...");
  const spec = "test/e2e/denali-negative-invariants.e2e-spec.ts";
  const r = spawnSync("node", ["--import", "tsx", "--test", spec], {
    cwd: path.join(REPO_ROOT, "apps/api"),
    encoding: "utf-8",
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) fail("Test", `E2E tests failed (exit ${r.status})`);
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  logStream = [];

  log("Pipeline", `Denali field update started (dryRun=${opts.dryRun}, prune=${opts.prune})`);

  const manifest = loadManifest(opts.fieldsPath);
  if (!manifest.fields?.length) fail("Manifest", "No fields in manifest");

  const resolved = manifest.fields.map(resolveField);
  log("Manifest", `Loaded ${resolved.length} field(s): ${resolved.map((f) => f.name).join(", ")}`);

  for (const f of resolved) {
    if (!f.registryKnown) {
      log(
        "Manifest",
        `Warning: "${f.name}" is not in FIELD_REGISTRY — canonical path defaults to "${f.canonical}"; extend run-denali-field-update.ts registry.`,
      );
    }
    if (f.conditional) {
      log(
        "Manifest",
        `Info: conditional visibility for "${f.name}" (${f.conditional}) must be implemented in denaliRuleModel / denaliUIAdapter manually.`,
      );
    }
    if (f.readOnly) {
      log("Manifest", `Info: read-only "${f.name}" — enforce in UI step components, not auto-patched.`);
    }
  }

  // Phase 1 — Registry sync (idempotent)
  log("Apply", "Phase 1: Sync DENALI_WIZARD_CANONICAL_FIELD_PATHS + form path map");
  const existing = readExistingCanonicalPaths(PATHS.ruleRequired);
  const pathSet = buildCanonicalPathSet(resolved, opts.prune, existing);
  const { changed: pathsChanged } = syncCanonicalFieldPathsSet(pathSet, opts.dryRun);
  const { changed: mapChanged } = syncCanonicalToFormMap(resolved, opts.dryRun);
  const changeVerb = opts.dryRun ? "would update" : "updated";
  log("Apply", `Registry paths: ${pathSet.length} (${pathsChanged ? changeVerb : "unchanged"})`);
  log("Apply", `Form path map: ${mapChanged ? changeVerb : "unchanged"}`);

  // Phase 2 — Layer verification
  log("Verify", "Phase 2: Cross-layer presence checks");
  const layerOk =
    verifyCanonicalModel(resolved) &&
    verifyRules(resolved) &&
    verifyNormalization(resolved) &&
    verifyUiSync(resolved) &&
    verifyProjection(resolved);

  if (!layerOk) {
    log(
      "Verify",
      "Some layers need manual edits (see warnings). Registry sync still applied where safe.",
    );
  }

  // Phase 3 — CI gates
  log("CI", "Phase 3: Static gates");
  const gates = [
    "check-canonical-gate.ts",
    "check-rules-gate.ts",
    "check-normalization-gate.ts",
    "check-projection-gate.ts",
    "check-ui-sync-gate.ts",
  ];
  for (const g of gates) runNodeGate(g);

  // Phase 4 — Tests
  if (!opts.skipTests && !opts.dryRun) {
    log("CI", "Phase 4: Unit + E2E tests");
    runUnitTests();
    runE2ETests();
  } else if (opts.dryRun) {
    log("CI", "Phase 4: Skipped (dry-run)");
  } else {
    log("CI", "Phase 4: Skipped (--skip-tests)");
  }

  flushLog(opts.logFile);
  log("Pipeline", "COMPLETED successfully");
  process.exit(0);
}

try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  log("Pipeline", `FAILED: ${msg}`);
  try {
    flushLog(process.argv.find((a) => a.startsWith("--log="))?.slice(6) ?? LOG_FILE_DEFAULT);
  } catch {
    /* ignore */
  }
  process.exit(1);
}
