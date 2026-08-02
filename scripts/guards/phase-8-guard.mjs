#!/usr/bin/env node
/**
 * Phase 8 guard — MAP §12 R2 verification-as-code (25 charter gates).
 * @see docs/phase-8/phase-8-guards.md · docs/phase-8/phase-8-charter.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyAntiHollow } from "./lib/anti-hollow-phase8.mjs";
import { REQUIRED_PHASE8_PEK_FILES, verifyDocHardening } from "./lib/phase-8-doc-hardening.mjs";
import {
  REQUIRED_PHASE8_8_1_API_SPECS,
  REQUIRED_PHASE8_HARDENING_YAML,
  verifyEnvelopeConsistency,
  verifyApiSurfaceAlignment,
  verifyEnvelopeSpecDepth,
  verifyEntryLedgerPresent,
  verifyCaslNoEllipsis,
  verifyProveWithParity,
  verifyTruthAttestationSync,
  verifyAgentNavigatorPresent,
  PHASE8_CHARTER_GATES,
  verifyDocPathConsistency,
  verifySpecPathRegistry,
  verifyHardeningArtifacts,
} from "./lib/phase-8-hardening-artifacts.mjs";
import {
  REPO_ROOT,
  evaluateP8BootManifest,
  evaluateP8EripCopPresent,
  evaluateP8PlatformCoreZeroDiff,
  evaluateP8TruthHonesty,
  failToken,
} from "./lib/phase-8-guard-lib.mjs";
import {
  verifyBoundaryCiHook,
  verifyOwnerAuthSpecs,
  verifySmokeMapPresent,
  verifyUrbanRoutesBound,
  verifyVerificationMatrixHydrated,
} from "./lib/phase-8-charter-deferred.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const PHASE8_CORPUS = "docs/phase-8";
const TQ_COMPLIANCE_FILE = "docs/phase-8/phase-8-charter.md";
const TQ_ATTESTATION_HEADING = "### TQ-P8-* cleanliness benchmarks";
const TQ_IDS = Array.from({ length: 10 }, (_, i) => `TQ-P8-${String(i + 1).padStart(3, "0")}`);

const REPORT_DATE = process.env.PHASE_8_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const LEGACY_IMPORT_PATTERNS = [
  /from\s+["']legacy\//,
  /import\s*\(\s*["']legacy\//,
  /require\s*\(\s*["']legacy\//,
];
/** Generated multi-plugin loader — sole web dynamic import surface (replaces lazy-denali/urban). */
const URBAN_DENALI_COUPLING_SKIP = new Set([
  "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
]);

const URBAN_DENALI_COUPLING_PATTERNS = [
  /@app-tour\/workspace-denali/,
  /workspaceType:\s*URBAN_WORKSPACE_TYPE[^}]*pluginId:\s*DENALI_WORKSPACE_PLUGIN_ID/,
  /workspaceType:\s*["']urban["'][^}]*pluginId:\s*["']denali["']/,
  /getWizardConfig\s*\(\s*["']urban["']\s*\)[^;]*wizardMode\s*===\s*["']denali["']/,
  /wizardMode\s*===\s*["']denali["'][^;]*urban/,
];

/**
 * @param {string} checkId
 * @param {string} detail
 * @returns {never}
 */
function failFast(checkId, detail) {
  const message = detail.startsWith("FAIL P8-GUARD-") ? detail : failToken(checkId, detail);
  console.error(message);
  process.exit(1);
}

/**
 * @param {string} checkId
 * @param {unknown} error
 * @returns {never}
 */
function failFastFromError(checkId, error) {
  const raw = error instanceof Error ? error.message : String(error);
  const body = raw.replace(/^FAIL P8-GUARD-[^:]+:\s*/u, "").trim();
  failFast(checkId, body || raw);
}

/**
 * @param {string} checkId
 * @param {{ ok: boolean; detail?: string | null }} result
 * @param {string} [passDetail]
 * @returns {{ id: string; required: boolean; ok: boolean; detail: string | null }}
 */
function assertSyncCheck(checkId, result, passDetail = null) {
  if (!result.ok) {
    failFast(checkId, result.detail ?? "check failed");
  }
  return {
    id: checkId,
    required: true,
    ok: true,
    detail: passDetail ?? result.detail ?? null,
  };
}

function gitShortSha() {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() : "unknown";
}

/**
 * @param {string} relFromRoot
 * @param {Set<string>} [skipDirNames]
 * @returns {string[]}
 */
function collectSourceFiles(
  relFromRoot,
  skipDirNames = new Set(["node_modules", "dist", ".next"])
) {
  const rootAbs = path.join(REPO_ROOT, relFromRoot);
  /** @type {string[]} */
  const files = [];

  if (!fs.existsSync(rootAbs)) {
    return files;
  }

  /** @param {string} dir */
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirNames.has(ent.name)) {
        continue;
      }
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile()) {
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        files.push(abs);
      }
    }
  }

  walk(rootAbs);
  return files;
}

/**
 * @returns {{ id: string; required: boolean; ok: boolean; detail: string | null }}
 */
function runP8NoLegacyRuntimeImport() {
  const scanRoots = ["apps/api", "apps/web", "packages/workspaces/urban"];
  /** @type {string[]} */
  const hits = [];

  for (const root of scanRoots) {
    for (const abs of collectSourceFiles(root)) {
      const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
      let content;
      try {
        content = fs.readFileSync(abs, "utf8");
      } catch (cause) {
        const err = cause instanceof Error ? cause.message : String(cause);
        failFast("p8_no_legacy_runtime_import", `cannot read ${rel}: ${err}`);
      }

      for (const pattern of LEGACY_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          hits.push(`${rel} matches ${pattern}`);
          break;
        }
      }
    }
  }

  if (hits.length > 0) {
    failFast(
      "p8_no_legacy_runtime_import",
      `runtime legacy import forbidden (RULE-P7-007): ${hits.join("; ")}`
    );
  }

  return {
    id: "p8_no_legacy_runtime_import",
    required: true,
    ok: true,
    detail: `no legacy/ imports in ${scanRoots.join(", ")}`,
  };
}

/**
 * @returns {{ id: string; required: boolean; ok: boolean; detail: string | null }}
 */
function runP8UrbanNotDenaliRail() {
  const failures = [];

  const urbanPkgPath = path.join(REPO_ROOT, "packages/workspaces/urban/package.json");
  if (fs.existsSync(urbanPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(urbanPkgPath, "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if ("@app-tour/workspace-denali" in deps) {
      failures.push("packages/workspaces/urban/package.json depends on @app-tour/workspace-denali");
    }
  }

  const bindingPath =
    "packages/workspace-sdk/src/plugin/workspace-manifest-bindings.generated.ts";
  if (fs.existsSync(path.join(REPO_ROOT, bindingPath))) {
    const binding = fs.readFileSync(path.join(REPO_ROOT, bindingPath), "utf8");
    if (/workspaceType:\s*"urban"[^}]*pluginId:\s*"denali"/.test(binding)) {
      failures.push(`${bindingPath} maps urban workspace type to denali plugin`);
    }
    if (!/workspaceType:\s*"urban"[^}]*pluginId:\s*"urban"/.test(binding)) {
      failures.push(`${bindingPath} must bind "urban" workspace type → "urban" plugin`);
    }
  }

  const urbanSourceTargets = [
    "packages/workspaces/urban/src",
    "apps/web/app/(app)/settings/workspace-owner",
    "apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts",
  ];

  for (const rel of urbanSourceTargets) {
    const absTarget = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(absTarget)) {
      continue;
    }

    /** @type {string[]} */
    const files = [];
    const stat = fs.statSync(absTarget);
    if (stat.isFile()) {
      files.push(absTarget);
    } else {
      for (const abs of collectSourceFiles(rel)) {
        const base = path.basename(abs);
        if (base.includes(".spec.") || base.includes(".test.")) {
          continue;
        }
        files.push(abs);
      }
    }

    for (const abs of files) {
      const fileRel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
      if (URBAN_DENALI_COUPLING_SKIP.has(fileRel)) {
        continue;
      }
      const content = fs.readFileSync(abs, "utf8");
      for (const pattern of URBAN_DENALI_COUPLING_PATTERNS) {
        if (pattern.test(content)) {
          failures.push(`${fileRel} matches forbidden urban↔denali coupling (${pattern})`);
          break;
        }
      }
    }
  }

  if (failures.length > 0) {
    failFast("p8_urban_not_denali_rail", failures.join("; "));
  }

  return {
    id: "p8_urban_not_denali_rail",
    required: true,
    ok: true,
    detail: "urban workspace isolated from denali rail (INV-P8-004 / FORB-P8-001)",
  };
}

/**
 * @returns {{ id: string; required: boolean; ok: boolean; detail: string | null }}
 */
function runP8TechnicalQuality() {
  const abs = path.join(REPO_ROOT, TQ_COMPLIANCE_FILE);
  if (!fs.existsSync(abs)) {
    failFast("p8_technical_quality", `missing compliance file ${TQ_COMPLIANCE_FILE}`);
  }

  const content = fs.readFileSync(abs, "utf8");
  if (!content.includes(TQ_ATTESTATION_HEADING)) {
    failFast(
      "p8_technical_quality",
      `${TQ_COMPLIANCE_FILE} missing mandatory block "${TQ_ATTESTATION_HEADING}"`
    );
  }

  const missing = TQ_IDS.filter((id) => !content.includes(`**${id}**`));
  if (missing.length > 0) {
    failFast(
      "p8_technical_quality",
      `${TQ_COMPLIANCE_FILE} missing TQ attestation rows: ${missing.join(", ")}`
    );
  }

  if (!/p8_technical_quality/.test(content)) {
    failFast(
      "p8_technical_quality",
      `${TQ_COMPLIANCE_FILE} must declare guard check id p8_technical_quality in charter gate table`
    );
  }

  return {
    id: "p8_technical_quality",
    required: true,
    ok: true,
    detail: `TQ-P8-001..010 attested in ${TQ_COMPLIANCE_FILE}`,
  };
}

/**
 * @returns {Promise<{ checks: object[]; activeSubphase: string | null; baselineSha: string | null }>}
 */
async function runAllChecks() {
  /** @type {object[]} */
  const checks = [];
  let activeSubphase = null;
  let baselineSha = null;

  checks.push(
    assertSyncCheck("p8_boot_manifest", evaluateP8BootManifest(), "BOOT-MANIFEST structural PASS")
  );

  checks.push(
    assertSyncCheck(
      "p8_truth_honesty",
      evaluateP8TruthHonesty(),
      "IMPLEMENTATION-TRUTH honesty PASS"
    )
  );

  const erip = evaluateP8EripCopPresent();
  checks.push(assertSyncCheck("p8_erip_cop_present", erip, erip.detail ?? "ERIP COP PASS"));
  activeSubphase = erip.currentSubphase ?? null;

  const zeroDiff = evaluateP8PlatformCoreZeroDiff();
  checks.push(
    assertSyncCheck(
      "p8_platform_core_zero_diff",
      zeroDiff,
      zeroDiff.detail ?? "platform-core zero diff PASS"
    )
  );
  baselineSha = zeroDiff.baselineSha ?? null;

  try {
    await verifyDocHardening(PHASE8_CORPUS);
  } catch (error) {
    failFastFromError("p8_doc_hardening", error);
  }
  checks.push({
    id: "p8_doc_hardening",
    required: true,
    ok: true,
    detail: `${REQUIRED_PHASE8_PEK_FILES.length} PEK files present under ${PHASE8_CORPUS}`,
  });

  try {
    await verifyAntiHollow(PHASE8_CORPUS);
  } catch (error) {
    failFastFromError("p8_anti_hollow", error);
  }
  checks.push({
    id: "p8_anti_hollow",
    required: true,
    ok: true,
    detail: `no hollow prose in ${PHASE8_CORPUS}`,
  });

  try {
    await verifyHardeningArtifacts();
  } catch (error) {
    failFastFromError("p8_hardening_artifacts", error);
  }
  checks.push({
    id: "p8_hardening_artifacts",
    required: true,
    ok: true,
    detail: `${REQUIRED_PHASE8_HARDENING_YAML.length} YAML + ${REQUIRED_PHASE8_8_1_API_SPECS.length} API spec scaffolds present and formatted`,
  });

  try {
    await verifyEnvelopeConsistency();
  } catch (error) {
    failFastFromError("p8_envelope_consistency", error);
  }
  checks.push({
    id: "p8_envelope_consistency",
    required: true,
    ok: true,
    detail: "DEC-P8-003 GET envelope vs PATCH urban root aligned across CASL, merge, dispatch",
  });

  try {
    await verifyDocPathConsistency();
  } catch (error) {
    failFastFromError("p8_doc_path_consistency", error);
  }
  checks.push({
    id: "p8_doc_path_consistency",
    required: true,
    ok: true,
    detail:
      "urban-settings-patch canonical in docs/phase-8 · BOOT-MANIFEST prove_with · flat urban/** boundary",
  });

  try {
    await verifySpecPathRegistry();
  } catch (error) {
    failFastFromError("p8_spec_path_registry", error);
  }
  checks.push({
    id: "p8_spec_path_registry",
    required: true,
    ok: true,
    detail: "6× Phase 8.1 spec scaffolds on disk (4 API + SDK + web) with anti-hollow structure",
  });

  try {
    await verifyCaslNoEllipsis();
  } catch (error) {
    failFastFromError("p8_casl_no_ellipsis", error);
  }
  checks.push({
    id: "p8_casl_no_ellipsis",
    required: true,
    ok: true,
    detail: "CASL-URBAN-OWNER-SPEC TenantAuthz full method surface — no existing-methods ellipsis",
  });

  try {
    await verifyTruthAttestationSync();
  } catch (error) {
    failFastFromError("p8_truth_attestation_sync", error);
  }
  checks.push({
    id: "p8_truth_attestation_sync",
    required: true,
    ok: true,
    detail: `IMPLEMENTATION-TRUTH attestation matches ${PHASE8_CHARTER_GATES}/${PHASE8_CHARTER_GATES} charter gates`,
  });

  try {
    await verifyAgentNavigatorPresent();
  } catch (error) {
    failFastFromError("p8_agent_navigator_present", error);
  }
  checks.push({
    id: "p8_agent_navigator_present",
    required: true,
    ok: true,
    detail: "AGENT-NAVIGATOR.md + AGENT-CURRENT-PHASE.yaml on disk · boot-6b/6c in BOOT-MANIFEST",
  });

  try {
    await verifyProveWithParity();
  } catch (error) {
    failFastFromError("p8_prove_with_parity", error);
  }
  checks.push({
    id: "p8_prove_with_parity",
    required: true,
    ok: true,
    detail:
      "SPEC-REGISTRY-8.1.yaml parity with BOOT-MANIFEST · 8.1 subphase · truth · verification-matrix",
  });

  try {
    await verifyApiSurfaceAlignment();
  } catch (error) {
    failFastFromError("p8_api_surface_alignment", error);
  }
  checks.push({
    id: "p8_api_surface_alignment",
    required: true,
    ok: true,
    detail:
      "DEC-P8-004 TenantAuthz method form · tenant-auth-grants isWorkspaceOwner · router web path",
  });

  try {
    await verifyEnvelopeSpecDepth();
  } catch (error) {
    failFastFromError("p8_envelope_spec_depth", error);
  }
  checks.push({
    id: "p8_envelope_spec_depth",
    required: true,
    ok: true,
    detail:
      "ASM-001 metadata keys correlationId · primaryColor · featureFlags · rateLimitRps in patch spec",
  });

  try {
    await verifyEntryLedgerPresent();
  } catch (error) {
    failFastFromError("p8_entry_ledger_present", error);
  }
  checks.push({
    id: "p8_entry_ledger_present",
    required: true,
    ok: true,
    detail:
      "reports/phase-8-entry-verified.yaml scaffold · phase_7_gate.status PENDING|PASS with honest exit_code",
  });

  try {
    await verifyOwnerAuthSpecs();
  } catch (error) {
    failFastFromError("p8_owner_auth_specs", error);
  }
  checks.push({
    id: "p8_owner_auth_specs",
    required: true,
    ok: true,
    detail: "CASL 8.1 route rows ↔ SDK/API/WEB case IDs on disk",
  });

  try {
    await verifyUrbanRoutesBound();
  } catch (error) {
    failFastFromError("p8_urban_routes_bound", error);
  }
  checks.push({
    id: "p8_urban_routes_bound",
    required: true,
    ok: true,
    detail:
      "URBAN-ROUTE-MATRIX §C settings paths ⊆ dispatch addendum · out-of-scope paths excluded",
  });

  try {
    await verifySmokeMapPresent();
  } catch (error) {
    failFastFromError("p8_smoke_map_present", error);
  }
  checks.push({
    id: "p8_smoke_map_present",
    required: true,
    ok: true,
    detail: "SMK-P8-01..04 each has executable command in verification-matrix",
  });

  try {
    await verifyVerificationMatrixHydrated();
  } catch (error) {
    failFastFromError("p8_verification_matrix_hydrated", error);
  }
  checks.push({
    id: "p8_verification_matrix_hydrated",
    required: true,
    ok: true,
    detail: "REQ-P8-010..012 rows cite spec anchors and on-disk test paths",
  });

  try {
    await verifyBoundaryCiHook();
  } catch (error) {
    failFastFromError("p8_boundary_ci_hook", error);
  }
  checks.push({
    id: "p8_boundary_ci_hook",
    required: true,
    ok: true,
    detail:
      "scripts/guards/p8-boundary-diff.mjs present · documented · PHASE-BOUNDARY-MATRIX ci_hook",
  });

  checks.push(runP8NoLegacyRuntimeImport());
  checks.push(runP8UrbanNotDenaliRail());
  checks.push(runP8TechnicalQuality());

  return { checks, activeSubphase, baselineSha };
}

async function main() {
  const { checks, activeSubphase, baselineSha } = await runAllChecks();

  const report = {
    gate: "phase-8",
    date: REPORT_DATE,
    gitSha: gitShortSha(),
    ok: true,
    fail_token: null,
    active_subphase: activeSubphase,
    platform_core_baseline_sha: baselineSha,
    checks,
    charter_gates: PHASE8_CHARTER_GATES,
    note: "phase-8:gate adds build+test+phase-7:guard — see package.json (denested from phase-7:gate)",
  };

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = path.join(REPORTS_DIR, `phase-8-gate-${REPORT_DATE}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`phase-8-guard: wrote ${reportPath}`);
  for (const c of checks) {
    console.log(`  PASS ${c.id}`);
    if (c.detail) {
      console.log(`         ${c.detail}`);
    }
  }
  console.log(`phase-8-guard: all ${PHASE8_CHARTER_GATES} charter gates PASS`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
