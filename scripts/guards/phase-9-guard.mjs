#!/usr/bin/env node
/**
 * Phase 9 guard — MAP §12 R2 verification-as-code (32 charter gates).
 * @see docs/phase-9/phase-9-guards.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  REPO_ROOT,
  evaluateP9BootManifest,
  evaluateP9TruthHonesty,
  evaluateP9EntryLedger,
  evaluateP9GateScript,
  failToken,
} from "./lib/phase-9-guard-lib.mjs";
import { verifyDocHardening, verifyAntiHollow } from "./lib/phase-9-doc-hardening.mjs";
import {
  PHASE9_CHARTER_GATES,
  verifyAdversarialMatrix,
  verifyBoundaryMatrixDepth,
  verifyE2eWiring,
  verifyEripCopDepth,
  verifyForensicRubric,
  verifyForbiddenCatalog,
  verifyHardeningArtifacts,
  verifyIdentitySchemaRegistry,
  verifyOperatorSpecDepth,
  verifyProductScopeOutList,
  verifyProveWithParity,
  verifySmokeFixtureSot,
  verifySpecPathRegistry,
  verifyTraceabilityMap,
  verifyTraceabilityPresent,
  verifyNavigatorPresent,
  verifyLeaderActorDrift,
  verifyFinancePathDual,
  verifyCurrentPhaseSnapshot,
  verifyScaffoldManifest,
} from "./lib/phase-9-hardening-artifacts.mjs";

const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const REPORT_DATE =
  process.env.PHASE_9_GATE_REPORT ?? new Date().toISOString().slice(0, 10);

/** @param {string} checkId @param {string} detail @returns {never} */
function failFast(checkId, detail) {
  const message =
    detail.startsWith("FAIL P9-GUARD-") ? detail : failToken(checkId, detail);
  console.error(message);
  process.exit(1);
}

/** @param {{ id: string, ok: boolean, detail?: string | null }} r */
function assertCheck(r) {
  if (!r.ok) {
    failFast(r.id, r.detail ?? `${r.id} failed`);
  }
  console.log(`PASS ${r.id}`);
}

/** @returns {{ ok: boolean, detail: string | null }} */
function evaluateP9PlatformCoreZeroDiff() {
  const baselineCandidates = [
    "reports/phase-9-genericity-baseline.yaml",
    "reports/phase-8-genericity-baseline.yaml",
    "reports/phase-7-genericity-baseline.yaml",
  ];
  let baselineSha = null;
  for (const rel of baselineCandidates) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, "utf8");
    const m = raw.match(/baseline_sha:\s*["']?([0-9a-f]{7,40})/);
    if (m) {
      baselineSha = m[1];
      break;
    }
  }
  if (!baselineSha) {
    return {
      ok: false,
      detail: failToken("p9_platform_core_zero_diff", "no baseline_sha in reports"),
    };
  }
  const diff = spawnSync(
    "git",
    ["diff", baselineSha, "--", "packages/platform-core"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (diff.status !== 0) {
    return {
      ok: false,
      detail: failToken("p9_platform_core_zero_diff", `git diff failed: ${diff.stderr}`),
    };
  }
  if (diff.stdout.trim().length > 0) {
    return {
      ok: false,
      detail: failToken("p9_platform_core_zero_diff", "platform-core diff non-empty"),
    };
  }
  return { ok: true, detail: null };
}

/** @type {Array<{ id: string, run: () => { ok: boolean, detail?: string | null } | Promise<{ ok: boolean, detail?: string | null }> }>} */
const checks = [
  {
    id: "p9_boot_manifest",
    run: () => {
      const r = evaluateP9BootManifest();
      return { id: "p9_boot_manifest", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_truth_honesty",
    run: () => {
      const r = evaluateP9TruthHonesty();
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/audits/IMPLEMENTATION-TRUTH.md"),
        "utf8",
      );
      const syncOk =
        /(28|32)\/(28|32) PASS/.test(raw) || /charter_gates:\s*(28|32)/.test(raw);
      return {
        id: "p9_truth_honesty",
        ok: r.ok && syncOk,
        detail: syncOk ? r.detail ?? undefined : failToken("p9_truth_honesty", "attestation not synced to 24 gates"),
      };
    },
  },
  {
    id: "p9_doc_hardening",
    run: () => {
      const r = verifyDocHardening();
      return { id: "p9_doc_hardening", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_anti_hollow",
    run: () => {
      const r = verifyAntiHollow();
      return { id: "p9_anti_hollow", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_hardening_artifacts",
    run: async () => {
      const base = await verifyHardeningArtifacts();
      if (!base.ok) return { id: "p9_hardening_artifacts", ...base };
      const schemas = await verifyIdentitySchemaRegistry();
      return { id: "p9_hardening_artifacts", ...schemas };
    },
  },
  {
    id: "p9_spec_path_registry",
    run: async () => ({ id: "p9_spec_path_registry", ...(await verifySpecPathRegistry()) }),
  },
  {
    id: "p9_prove_with_parity",
    run: async () => ({ id: "p9_prove_with_parity", ...(await verifyProveWithParity()) }),
  },
  {
    id: "p9_traceability_9_1",
    run: async () => ({ id: "p9_traceability_9_1", ...(await verifyTraceabilityPresent()) }),
  },
  {
    id: "p9_operator_spec_depth",
    run: async () => ({ id: "p9_operator_spec_depth", ...(await verifyOperatorSpecDepth()) }),
  },
  {
    id: "p9_forbidden_catalog",
    run: async () => ({ id: "p9_forbidden_catalog", ...(await verifyForbiddenCatalog()) }),
  },
  {
    id: "p9_product_scope_out",
    run: async () => ({ id: "p9_product_scope_out", ...(await verifyProductScopeOutList()) }),
  },
  {
    id: "p9_traceability_map",
    run: async () => ({ id: "p9_traceability_map", ...(await verifyTraceabilityMap()) }),
  },
  {
    id: "p9_boundary_matrix_depth",
    run: async () => ({ id: "p9_boundary_matrix_depth", ...(await verifyBoundaryMatrixDepth()) }),
  },
  {
    id: "p9_entry_ledger_present",
    run: () => {
      const r = evaluateP9EntryLedger();
      return { ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_verification_matrix",
    run: () => {
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/audits/verification-matrix.md"),
        "utf8",
      );
      const count = (raw.match(/^\| \*\*REQ-P9-/gm) ?? []).length;
      const ok = count >= 15 && raw.includes("P9-F-001");
      return {
        ok,
        detail: ok ? null : failToken("p9_verification_matrix", "matrix incomplete"),
      };
    },
  },
  {
    id: "p9_admin_route_matrix",
    run: () => {
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/appendices/ADMIN-ROUTE-MATRIX.md"),
        "utf8",
      );
      const ok =
        /INV-P9-007/.test(raw) &&
        /\(app\)/.test(raw) &&
        /\/tours\/new/.test(raw);
      return {
        ok,
        detail: ok ? null : failToken("p9_admin_route_matrix", "matrix incomplete"),
      };
    },
  },
  {
    id: "p9_decisions_locked",
    run: () => {
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/appendices/IMPLEMENTATION-DECISIONS.md"),
        "utf8",
      );
      const ok = [
        "DEC-P9-001",
        "DEC-P9-002",
        "DEC-P9-003",
        "DEC-P9-004",
        "DEC-P9-007",
        "DEC-P9-008",
        "DEC-P9-009",
        "DEC-P9-010",
        "DEC-P9-011",
        "DEC-P9-012",
        "DEC-P9-013",
        "DEC-P9-014",
        "DEC-P9-015",
        "DEC-P9-016",
      ].every((d) => raw.includes(d));
      return {
        ok,
        detail: ok ? null : failToken("p9_decisions_locked", "missing DEC rows"),
      };
    },
  },
  {
    id: "p9_subphase_specs",
    run: () => {
      const names = [
        "9.0-entry.md",
        "9.1-identity-session.md",
        "9.2-admin-shell.md",
        "9.3-tours-operator.md",
        "9.4-users-rbac.md",
        "9.5-bookings-ops.md",
        "9.6-settings-templates.md",
        "9.7-finance-denali.md",
        "9.8-operator-dod-gate.md",
      ];
      const missing = names.filter(
        (n) => !fs.existsSync(path.join(REPO_ROOT, "docs/phase-9/subphases", n)),
      );
      return {
        ok: missing.length === 0,
        detail:
          missing.length === 0
            ? null
            : failToken("p9_subphase_specs", `missing ${missing.join(", ")}`),
      };
    },
  },
  {
    id: "p9_smoke_map_present",
    run: () => {
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md"),
        "utf8",
      );
      const ok = [
        "SMK-P9-01",
        "SMK-P9-02",
        "SMK-P9-03",
        "SMK-P9-04",
        "SMK-P9-05",
        "SMK-P9-06",
        "SMK-P9-07",
        "SMK-P9-08",
      ].every((s) => raw.includes(s));
      return { ok, detail: ok ? null : failToken("p9_smoke_map_present", "incomplete SMK") };
    },
  },
  {
    id: "p9_erip_cop_depth",
    run: async () => ({ id: "p9_erip_cop_depth", ...(await verifyEripCopDepth()) }),
  },
  {
    id: "p9_forensic_rubric",
    run: async () => ({ id: "p9_forensic_rubric", ...(await verifyForensicRubric()) }),
  },
  {
    id: "p9_smoke_fixture_sot",
    run: async () => ({ id: "p9_smoke_fixture_sot", ...(await verifySmokeFixtureSot()) }),
  },
  {
    id: "p9_e2e_wiring",
    run: async () => ({ id: "p9_e2e_wiring", ...(await verifyE2eWiring()) }),
  },
  {
    id: "p9_adversarial_matrix",
    run: async () => ({ id: "p9_adversarial_matrix", ...(await verifyAdversarialMatrix()) }),
  },
  {
    id: "p9_platform_core_zero_diff",
    run: () => evaluateP9PlatformCoreZeroDiff(),
  },
  {
    id: "p9_no_legacy_runtime_import",
    run: () => {
      const patterns = [/from\s+["']legacy\//, /import\s*\(\s*["']legacy\//];
      for (const root of ["apps/api", "apps/web"]) {
        const abs = path.join(REPO_ROOT, root);
        if (!fs.existsSync(abs)) continue;
        /** @param {string} dir */
        const walk = (dir) => {
          for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              if (ent.name === "node_modules") continue;
              walk(p);
            } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) {
              const src = fs.readFileSync(p, "utf8");
              if (patterns.some((re) => re.test(src))) {
                return failToken(
                  "p9_no_legacy_runtime_import",
                  `legacy import in ${path.relative(REPO_ROOT, p)}`,
                );
              }
            }
          }
          return null;
        };
        const hit = walk(abs);
        if (hit) return { ok: false, detail: hit };
      }
      return { ok: true, detail: null };
    },
  },
  {
    id: "p9_phase9_gate_script",
    run: () => {
      const r = evaluateP9GateScript();
      return { ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_technical_quality",
    run: () => {
      const raw = fs.readFileSync(
        path.join(REPO_ROOT, "docs/phase-9/phase-9-charter.md"),
        "utf8",
      );
      const ids = Array.from({ length: 10 }, (_, i) => `TQ-P9-${String(i + 1).padStart(3, "0")}`);
      return {
        ok: ids.every((id) => raw.includes(id)),
        detail: null,
      };
    },
  },
  {
    id: "p9_navigator_present",
    run: async () => {
      const r = await verifyNavigatorPresent();
      return { id: "p9_navigator_present", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_leader_actor_drift",
    run: async () => {
      const r = await verifyLeaderActorDrift();
      return { id: "p9_leader_actor_drift", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_finance_path_dual",
    run: async () => {
      const r = await verifyFinancePathDual();
      return { id: "p9_finance_path_dual", ok: r.ok, detail: r.detail ?? undefined };
    },
  },
  {
    id: "p9_current_phase_snapshot",
    run: async () => {
      const snap = await verifyCurrentPhaseSnapshot();
      if (!snap.ok) return { id: "p9_current_phase_snapshot", ...snap };
      const manifest = await verifyScaffoldManifest();
      return { id: "p9_current_phase_snapshot", ...manifest };
    },
  },
];

if (checks.length !== PHASE9_CHARTER_GATES) {
  failFast(
    "internal",
    failToken("internal", `expected ${PHASE9_CHARTER_GATES} checks, got ${checks.length}`),
  );
}

console.log(`phase-9:guard — ${PHASE9_CHARTER_GATES} charter gates\n`);

for (const check of checks) {
  const result = await Promise.resolve(check.run());
  assertCheck({
    id: result.id ?? check.id,
    ok: result.ok,
    detail: result.detail ?? undefined,
  });
}

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const report = {
  ok: true,
  date: REPORT_DATE,
  charter_gates: PHASE9_CHARTER_GATES,
  passed: PHASE9_CHARTER_GATES,
  phase: 9,
  doc_pack: "VERIFIED_SCAFFOLD",
};
const reportPath = path.join(REPORTS_DIR, `phase-9-gate-${REPORT_DATE}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\nphase-9:guard ${PHASE9_CHARTER_GATES}/${PHASE9_CHARTER_GATES} PASS`);
console.log(`report: ${path.relative(REPO_ROOT, reportPath)}`);
