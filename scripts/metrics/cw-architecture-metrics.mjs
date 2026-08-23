#!/usr/bin/env node
/**
 * CW0-09 — deterministic composable-workspace architecture metrics.
 * Usage: node scripts/metrics/cw-architecture-metrics.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { planGuestWorkspaceScaffoldPaths } from "../workspace-create.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_VERSION = 1;
const RULES_VERSION = 1;
const COPIED_MODULE_SIMILARITY_THRESHOLD = 0.85;

const ONBOARDING_INPUTS = JSON.parse(
  readFileSync(join(REPO_ROOT, "scripts/metrics/cw-similar-workspace-onboarding-inputs.json"), "utf8")
);

/** Versioned allowlist — workspace-ID branch hits permitted in neutral production code. */
const WORKSPACE_ID_BRANCH_ALLOWLIST = [
  {
    path: "apps/api/src/tenant/resolve-workspace-type.ts",
    rationale: "Phase 11 smoke tenant workspace-type resolution (DEC-P11-001)",
  },
];

const FORMAL_CAPABILITY_MANIFEST_KEYS = [
  "workspaceFinance",
  "workspaceBooking",
  "catalogRegistrationFlow",
];

const GENERATED_BINDING_MARKERS = {
  workspaceFinance: [
    "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts",
    "apps/api/src/workspace/workspace-plugin-registry.generated.ts",
  ],
  workspaceBooking: [
    "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts",
    "apps/api/src/workspace/workspace-plugin-registry.generated.ts",
  ],
  catalogRegistrationFlow: [
    "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts",
    "packages/guest-workspace-runtime/src",
  ],
};

const CERTIFICATION_SPEC_MARKERS = {
  workspaceFinance: ["finance-capability-certification.spec.ts"],
  workspaceBooking: ["booking-openapi-certification.spec.ts"],
  catalogRegistrationFlow: ["workspace-certification-guard.spec.mjs", "guest-plugin-conformance"],
};

const SHARED_TOUR_RULE_CATALOG = [
  {
    id: "parseCanonicalDocumentFromStorage",
    symbols: ["parseCanonicalDocumentFromStorage"],
    permittedOwners: ["packages/workspace-sdk"],
  },
  {
    id: "wizard-render-plan-steps",
    symbols: ["buildRenderPlan", "listActiveSteps", "listStepIds"],
    permittedOwners: ["packages/platform-core"],
  },
  {
    id: "validateCanonicalDocument",
    symbols: ["validateCanonicalDocument"],
    permittedOwners: ["packages/platform-core"],
  },
  {
    id: "validateLifecycleGraph",
    symbols: ["validateLifecycleGraph"],
    permittedOwners: ["packages/workspace-sdk"],
  },
  {
    id: "booking-status-vocabulary",
    symbols: ["BOOKING_STATUSES", "rejectBooking"],
    permittedOwners: ["packages/booking-http-contracts", "apps/api/src/bookings"],
  },
  {
    id: "sumApprovedPartySizeInTx",
    symbols: ["sumApprovedPartySizeInTx", "sumApprovedPartySizeByTourIds"],
    permittedOwners: ["apps/api/src/bookings"],
  },
  {
    id: "rejectBooking-silent",
    symbols: ["rejectBooking"],
    permittedOwners: ["apps/api/src/bookings"],
  },
  {
    id: "registration-capacity-decision",
    symbols: ["resolveRegistrationCapacityDecision", "sumAcceptedRegistrationSeats"],
    permittedOwners: ["apps/api/src/registrations"],
  },
  {
    id: "requireWorkspacePublishedTour",
    symbols: ["requireWorkspacePublishedTour"],
    permittedOwners: ["packages/workspace-sdk", "apps/api"],
  },
  {
    id: "createTourDepartureNotSetValidationError",
    symbols: ["createTourDepartureNotSetValidationError"],
    permittedOwners: ["packages/workspace-sdk", "apps/api"],
  },
  {
    id: "computeSpotsRemaining",
    symbols: ["computeSpotsRemaining", "withSpotsRemaining"],
    permittedOwners: [
      "packages/workspaces/denali",
      "packages/tour-core",
    ],
  },
  {
    id: "assertTourCapacityInTx",
    symbols: ["assertTourCapacityInTx"],
    permittedOwners: ["apps/api/src/canonical"],
  },
  {
    id: "assertWorkspaceRegistrationContactBasics",
    symbols: ["assertWorkspaceRegistrationContactBasics"],
    permittedOwners: ["packages/workspace-sdk"],
  },
];

const INCLUDE_ROOTS = [
  "apps/api/src",
  "apps/web/src",
  "apps/portal/src",
  "apps/marketing/src",
];

const EXCLUDE_PATH_SEGMENTS = [
  "/node_modules/",
  "/dist/",
  "/legacy/",
  "/packages/workspaces/",
  "/fixtures/",
];

const EXCLUDE_FILE_PATTERNS = [
  /\.generated\.ts$/,
  /\.spec\.ts$/,
  /\.test\.ts$/,
  /\.fixture\.ts$/,
  /smoke/i,
];

/**
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  return `${JSON.stringify(sortDeep(value), null, 2)}\n`;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortDeep(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortDeep(value[key]);
  }
  return out;
}

function repositoryRef() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function discoverWorkspaceIds() {
  const root = join(REPO_ROOT, "packages/workspaces");
  const ids = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(root, entry.name, "workspace.manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (typeof manifest.id === "string") {
      ids.push(manifest.id);
    }
  }
  return [...new Set(ids)].sort();
}

/**
 * @param {string} abs
 * @returns {boolean}
 */
function shouldScanFile(abs, includeWorkspaces = false) {
  const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
  if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) {
    return false;
  }
  for (const seg of EXCLUDE_PATH_SEGMENTS) {
    if (!includeWorkspaces && seg === "/packages/workspaces/") continue;
    if (rel.includes(seg)) {
      return false;
    }
  }
  for (const pattern of EXCLUDE_FILE_PATTERNS) {
    if (pattern.test(rel)) {
      return false;
    }
  }
  return true;
}

/**
 * @param {string} relRoot
 * @returns {string[]}
 */
function listPackageSrcRoots(relRoot) {
  const abs = join(REPO_ROOT, relRoot);
  if (!existsSync(abs)) {
    return [];
  }
  if (relRoot === "packages") {
    const out = [];
    for (const pkg of readdirSync(abs, { withFileTypes: true })) {
      if (!pkg.isDirectory() || pkg.name === "workspaces") continue;
      const src = join(abs, pkg.name, "src");
      if (existsSync(src)) {
        out.push(src);
      }
    }
    return out;
  }
  return [abs];
}

/**
 * @param {string} dir
 * @param {boolean} includeWorkspaces
 * @returns {string[]}
 */
function walkFiles(dir, includeWorkspaces = false) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...walkFiles(abs, includeWorkspaces));
      continue;
    }
    if (shouldScanFile(abs, includeWorkspaces)) {
      files.push(abs);
    }
  }
  return files;
}

function collectProductionFiles(options = { includeWorkspaces: false }) {
  const roots = [
    ...INCLUDE_ROOTS.map((r) => join(REPO_ROOT, r)),
    ...listPackageSrcRoots("packages"),
  ];
  if (options.includeWorkspaces) {
    const wsRoot = join(REPO_ROOT, "packages/workspaces");
    if (existsSync(wsRoot)) {
      for (const entry of readdirSync(wsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const src = join(wsRoot, entry.name, "src");
        if (existsSync(src)) roots.push(src);
      }
    }
  }
  const files = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    files.push(...walkFiles(root, options.includeWorkspaces));
  }
  return [...new Set(files)].sort();
}

/**
 * @param {readonly string[]} workspaceIds
 */
function metricWorkspaceIdBranches(workspaceIds) {
  const files = collectProductionFiles();
  /** @type {Array<{ path: string; line: number; workspaceId: string; kind: string }>} */
  const hits = [];
  /** @type {Array<{ path: string; line: number; workspaceId: string; kind: string }>} */
  const allowlistedHits = [];

  const allowSet = new Set(
    WORKSPACE_ID_BRANCH_ALLOWLIST.map((entry) => entry.path.replace(/\\/g, "/"))
  );

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const lines = readFileSync(abs, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const workspaceId of workspaceIds) {
        const eqPatterns = [
          new RegExp(`===\\s*["']${workspaceId}["']`),
          new RegExp(`!==\\s*["']${workspaceId}["']`),
          new RegExp(`==\\s*["']${workspaceId}["']`),
        ];
        const switchPattern = new RegExp(`case\\s+["']${workspaceId}["']`);
        const setPattern = new RegExp(`["']${workspaceId}["']`);

        let kind = null;
        if (eqPatterns.some((p) => p.test(line))) {
          kind = "equality";
        } else if (switchPattern.test(line)) {
          kind = "switch-case";
        } else if (
          /pluginId|workspaceType|workspaceTypes|supportedWorkspaceTypes/.test(line) &&
          setPattern.test(line)
        ) {
          kind = "literal-set";
        }

        if (!kind) continue;

        const hit = { path: rel, line: i + 1, workspaceId, kind };
        if (allowSet.has(rel)) {
          allowlistedHits.push(hit);
        } else {
          hits.push(hit);
        }
      }
    }
  }

  hits.sort((a, b) =>
    a.path.localeCompare(b.path) || a.line - b.line || a.workspaceId.localeCompare(b.workspaceId)
  );
  allowlistedHits.sort((a, b) =>
    a.path.localeCompare(b.path) || a.line - b.line || a.workspaceId.localeCompare(b.workspaceId)
  );

  return {
    count: hits.length,
    hits,
    allowlistedHits,
    allowlist: WORKSPACE_ID_BRANCH_ALLOWLIST,
  };
}

function metricDirectWorkspaceImports() {
  const files = collectProductionFiles();
  /** @type {Array<{ path: string; line: number; specifier: string; workspacePackage: string }>} */
  const hits = [];

  const importRe =
    /(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+from\s+)?["'](@app-tour\/workspace-[^"']+)["']|import\s*\(\s*["'](@app-tour\/workspace-[^"']+)["']\s*\)/g;

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const content = readFileSync(abs, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      importRe.lastIndex = 0;
      let match;
      while ((match = importRe.exec(line)) !== null) {
        const specifier = match[1] ?? match[2];
        hits.push({
          path: rel,
          line: i + 1,
          specifier,
          workspacePackage: specifier.split("/").slice(0, 2).join("/"),
        });
      }
    }
  }

  hits.sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.line - b.line ||
    a.specifier.localeCompare(b.specifier)
  );

  const denaliCount = hits.filter((h) => h.workspacePackage === "@app-tour/workspace-denali").length;
  const byWorkspace = {};
  for (const hit of hits) {
    byWorkspace[hit.workspacePackage] = (byWorkspace[hit.workspacePackage] ?? 0) + 1;
  }

  return {
    count: hits.length,
    denaliCount,
    byWorkspace: Object.fromEntries(
      Object.keys(byWorkspace)
        .sort()
        .map((key) => [key, byWorkspace[key]])
    ),
    hits,
  };
}

function metricGenericHostEditsForOnboarding() {
  const similarId = ONBOARDING_INPUTS.similarWorkspaceId;
  const workspacePrefix = `packages/workspaces/${similarId}/`;

  for (const op of ONBOARDING_INPUTS.operations) {
    if (op.type === "planner" && op.planner === "guest-scaffold") {
      planGuestWorkspaceScaffoldPaths(similarId);
    } else if (op.type !== "generated-outputs") {
      throw new Error(`CW0-09: unsupported onboarding operation type ${op.type}`);
    }
  }

  const manualPaths = [...ONBOARDING_INPUTS.manualHostEditPaths].sort();
  const generatedOutputs = [...ONBOARDING_INPUTS.generatedRegistryOutputs].sort();

  const plannedManualOutsideWorkspace = manualPaths.filter(
    (p) => !p.startsWith(workspacePrefix) && !p.includes(".generated.")
  );

  return {
    count: plannedManualOutsideWorkspace.length,
    similarWorkspaceId: similarId,
    manualHostEditPaths: manualPaths,
    generatedRegistryOutputCount: generatedOutputs.length,
    plannedManualOutsideWorkspace,
  };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listTsTsxUnder(dir) {
  if (!existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      out.push(...listTsTsxUnder(abs));
      continue;
    }
    if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") && !entry.name.includes(".generated.")) {
      out.push(abs);
    }
  }
  return out.sort();
}

function normalizedLineSet(abs) {
  return readFileSync(abs, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));
}

/**
 * @param {string[]} a
 * @param {string[]} b
 */
function lineSimilarity(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  let intersect = 0;
  for (const line of b) {
    if (setA.has(line)) intersect += 1;
  }
  return intersect / Math.max(a.length, b.length);
}

function metricManualCopiedModules() {
  const similarId = ONBOARDING_INPUTS.similarWorkspaceId;
  const denaliRoot = join(REPO_ROOT, "packages/workspaces/denali/src");
  const harborRoot = join(REPO_ROOT, "packages/workspaces/harbor/src");

  const denaliFiles = listTsTsxUnder(denaliRoot);
  const guestScaffoldPaths = planGuestWorkspaceScaffoldPaths(similarId)
    .filter((p) => /\.tsx?$/.test(p) && !p.includes("/test/"));
  const harborFiles = listTsTsxUnder(harborRoot);

  /** @type {Array<{ harborPath: string; denaliPath: string; similarity: number }>} */
  const copiedPairs = [];

  for (const harborAbs of harborFiles) {
    const relHarbor = relative(harborRoot, harborAbs).replace(/\\/g, "/");
    const denaliCandidate = join(denaliRoot, relHarbor);
    if (!existsSync(denaliCandidate)) continue;
    const similarity = lineSimilarity(
      normalizedLineSet(harborAbs),
      normalizedLineSet(denaliCandidate)
    );
    if (similarity >= COPIED_MODULE_SIMILARITY_THRESHOLD) {
      copiedPairs.push({
        harborPath: `packages/workspaces/harbor/src/${relHarbor}`,
        denaliPath: `packages/workspaces/denali/src/${relHarbor}`,
        similarity: Number(similarity.toFixed(4)),
      });
    }
  }

  copiedPairs.sort((a, b) => a.harborPath.localeCompare(b.harborPath));

  return {
    denaliSourceTsTsxCount: denaliFiles.length,
    guestScaffoldTsTsxCount: guestScaffoldPaths.length,
    harborSourceTsTsxCount: harborFiles.length,
    copiedModuleSimilarityThreshold: COPIED_MODULE_SIMILARITY_THRESHOLD,
    copiedModulePairCount: copiedPairs.length,
    copiedModulePairs: copiedPairs,
    guestScaffoldPaths,
  };
}

function findSymbolImplementationSites(symbol) {
  const files = collectProductionFiles({ includeWorkspaces: true });
  /** @type {Array<{ path: string; line: number; symbol: string }>} */
  const sites = [];
  const defRe = new RegExp(
    `export\\s+(?:async\\s+)?function\\s+${symbol}\\b|export\\s+const\\s+${symbol}\\b`
  );

  for (const abs of files) {
    const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
    const lines = readFileSync(abs, "utf8").split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (defRe.test(lines[i])) {
        sites.push({ path: rel, line: i + 1, symbol });
      }
    }
  }
  sites.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return sites;
}

function findReexportSites(symbol) {
  const roots = [
    join(REPO_ROOT, "packages"),
    join(REPO_ROOT, "apps"),
  ];
  /** @type {Array<{ path: string; line: number; symbol: string }>} */
  const sites = [];
  const reexportRe = new RegExp(`export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`);

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const abs of walkFiles(root)) {
      const rel = relative(REPO_ROOT, abs).replace(/\\/g, "/");
      const lines = readFileSync(abs, "utf8").split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (reexportRe.test(lines[i])) {
          sites.push({ path: rel, line: i + 1, symbol });
        }
      }
    }
  }
  sites.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return sites;
}

function ownerMatches(path, permittedOwners) {
  const normalized = path.replace(/\\/g, "/");
  return permittedOwners.some((owner) => normalized.includes(owner.replace(/\\/g, "/")));
}

function metricSharedTourRulesSingleOwnership() {
  /** @type {Array<Record<string, unknown>>} */
  const rules = [];

  for (const entry of SHARED_TOUR_RULE_CATALOG) {
    /** @type {Array<{ path: string; line: number; symbol: string }>} */
    const implementationSites = [];
    for (const symbol of entry.symbols) {
      implementationSites.push(...findSymbolImplementationSites(symbol));
    }
    const uniqueImpl = [...new Map(implementationSites.map((s) => [`${s.path}:${s.line}`, s])).values()];
    uniqueImpl.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

    /** @type {Array<{ path: string; line: number; symbol: string }>} */
    const reexportSites = [];
    for (const symbol of entry.symbols) {
      reexportSites.push(...findReexportSites(symbol));
    }
    const uniqueReexport = [...new Map(reexportSites.map((s) => [`${s.path}:${s.line}`, s])).values()];
    uniqueReexport.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);

    const implOwners = uniqueImpl.filter((site) =>
      ownerMatches(site.path, entry.permittedOwners)
    );
    const outsidePermittedOwnerSites = uniqueImpl.filter(
      (site) => !ownerMatches(site.path, entry.permittedOwners)
    );

    if (uniqueImpl.length === 0) {
      throw new Error(`CW0-09: rule ${entry.id} — no implementation sites found for symbols`);
    }

    const singleOwner =
      outsidePermittedOwnerSites.length === 0 &&
      uniqueImpl.length <= 1 &&
      uniqueReexport.length <= 1;

    rules.push({
      id: entry.id,
      symbols: [...entry.symbols].sort(),
      permittedOwners: [...entry.permittedOwners].sort(),
      implementationSiteCount: uniqueImpl.length,
      implementationSites: uniqueImpl,
      outsidePermittedOwnerSiteCount: outsidePermittedOwnerSites.length,
      outsidePermittedOwnerSites,
      reexportSiteCount: uniqueReexport.length,
      reexportSites: uniqueReexport,
      singleOwner,
    });
  }

  const singleOwnerCount = rules.filter((r) => r.singleOwner).length;

  return {
    catalogRuleCount: rules.length,
    singleOwnerCount,
    singleOwnerRatio: rules.length === 0 ? 1 : Number((singleOwnerCount / rules.length).toFixed(4)),
    rules,
  };
}

function fileContainsAny(abs, needles) {
  if (!existsSync(abs)) return false;
  const content = readFileSync(abs, "utf8");
  return needles.some((needle) => content.includes(needle));
}

function metricFormalReusableCapabilities() {
  const manifestRoot = join(REPO_ROOT, "packages/workspaces");
  /** @type {Array<Record<string, unknown>>} */
  const capabilities = [];
  /** @type {Array<Record<string, unknown>>} */
  const rejected = [];

  for (const ws of readdirSync(manifestRoot, { withFileTypes: true })) {
    if (!ws.isDirectory()) continue;
    const manifestPath = join(manifestRoot, ws.name, "workspace.manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const workspaceId = manifest.id;

    for (const key of FORMAL_CAPABILITY_MANIFEST_KEYS) {
      if (manifest[key] === undefined) continue;

      const missing = [];
      const manifestKeyPresent = true;
      let generatedBindingPresent = false;
      let certificationSpecPresent = false;

      const markers = GENERATED_BINDING_MARKERS[key] ?? [];
      generatedBindingPresent = markers.some((marker) => {
        const abs = join(REPO_ROOT, marker);
        if (marker.endsWith("/src")) {
          return existsSync(abs) && fileContainsAny(join(abs, "index.ts"), [key, workspaceId]);
        }
        return fileContainsAny(abs, [key, workspaceId]);
      });

      const certMarkers = CERTIFICATION_SPEC_MARKERS[key] ?? [];
      certificationSpecPresent = certMarkers.some((marker) => {
        const guardPath = join(REPO_ROOT, "scripts/guards", marker);
        const testPaths = [
          join(REPO_ROOT, "apps/api/src", marker),
          join(REPO_ROOT, "scripts/test", marker),
          guardPath,
        ];
        return testPaths.some((p) => existsSync(p));
      });

      if (!manifestKeyPresent) missing.push("manifest-schema-key");
      if (!generatedBindingPresent) missing.push("generated-binding");
      if (!certificationSpecPresent) missing.push("certification-spec");

      const entry = {
        capabilityKey: key,
        workspaceId,
        manifestKeyPresent,
        generatedBindingPresent,
        certificationSpecPresent,
        qualified: missing.length === 0,
        missingCriteria: missing.sort(),
      };

      if (entry.qualified) {
        capabilities.push(entry);
      } else {
        rejected.push(entry);
      }
    }
  }

  capabilities.sort((a, b) =>
    String(a.capabilityKey).localeCompare(String(b.capabilityKey)) ||
    String(a.workspaceId).localeCompare(String(b.workspaceId))
  );
  rejected.sort((a, b) =>
    String(a.capabilityKey).localeCompare(String(b.capabilityKey)) ||
    String(a.workspaceId).localeCompare(String(b.workspaceId))
  );

  return {
    qualifiedCount: capabilities.length,
    rejectedCount: rejected.length,
    capabilities,
    rejected,
  };
}

function buildMetrics() {
  const workspaceIds = discoverWorkspaceIds();

  return {
    workspaceIdBranches: metricWorkspaceIdBranches(workspaceIds),
    directWorkspaceImports: metricDirectWorkspaceImports(),
    genericHostEditsForOnboarding: metricGenericHostEditsForOnboarding(),
    manualCopiedModules: metricManualCopiedModules(),
    sharedTourRulesSingleOwnership: metricSharedTourRulesSingleOwnership(),
    formalReusableCapabilities: metricFormalReusableCapabilities(),
  };
}

function main() {
  const output = {
    schemaVersion: SCHEMA_VERSION,
    repositoryRef: repositoryRef(),
    rulesVersion: RULES_VERSION,
    metrics: buildMetrics(),
    evidence: {
      workspaceIds: discoverWorkspaceIds(),
      inclusionRoots: [...INCLUDE_ROOTS, "packages/*/src (excluding packages/workspaces)"].sort(),
      exclusionNotes: [
        "packages/workspaces/**",
        "legacy/**",
        "**/*.generated.ts",
        "**/*.spec.ts",
        "**/*.test.ts",
        "fixtures and smoke paths",
      ],
    },
  };

  process.stdout.write(stableStringify(output));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { buildMetrics, stableStringify, SCHEMA_VERSION, RULES_VERSION };
