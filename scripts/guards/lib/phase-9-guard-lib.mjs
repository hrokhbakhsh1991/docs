#!/usr/bin/env node
/**
 * Phase 9 guard — reusable evaluators (MAP §12 R2).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export { PHASE9_CHARTER_GATES } from "./phase-9-hardening-artifacts.mjs";

const FAIL_TOKEN = "FAIL";

export function readUtf8(relFromRoot) {
  return fs.readFileSync(path.join(REPO_ROOT, relFromRoot), "utf8");
}

export function exists(relFromRoot) {
  return fs.existsSync(path.join(REPO_ROOT, relFromRoot));
}

/**
 * @param {string} checkId
 * @param {string} detail
 * @returns {string}
 */
export function failToken(checkId, detail) {
  return `${FAIL_TOKEN} P9-GUARD-${checkId}: ${detail}`;
}

const SUBPHASE_IDS = ["9.0", "9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8"];

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP9BootManifest() {
  const rel = "docs/phase-9/appendices/BOOT-MANIFEST.yaml";
  if (!exists(rel)) {
    return { ok: false, detail: failToken("p9_boot_manifest", `missing ${rel}`) };
  }

  const raw = readUtf8(rel);
  const failures = [];

  if (raw.includes("\t")) failures.push("BOOT-MANIFEST must not contain tab characters");
  if (!/^manifest_version:\s/m.test(raw)) failures.push("missing manifest_version");
  if (!/^phase_id:\s*"9"/m.test(raw)) failures.push('phase_id must be "9"');
  if (!/^subphases:/m.test(raw)) failures.push("missing subphases block");
  for (const id of SUBPHASE_IDS) {
    if (!new RegExp(`"${id.replace(".", "\\.")}":`).test(raw)) {
      failures.push(`subphases missing key "${id}"`);
    }
  }
  if (!/detect_current_subphase:/m.test(raw)) failures.push("missing detect_current_subphase");
  if (!/gate_chain:/m.test(raw)) failures.push("missing gate_chain");
  if (!/phase-9:guard:/m.test(raw)) failures.push("gate_chain must declare phase-9:guard");
  if (!/FORB-P9-002|INV-P9-001/m.test(raw)) {
    failures.push("missing platform-core forbidden invariant reference");
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP9TruthHonesty() {
  const rel = "docs/phase-9/audits/IMPLEMENTATION-TRUTH.md";
  if (!exists(rel)) {
    return { ok: false, detail: failToken("p9_truth_honesty", `missing ${rel}`) };
  }

  const raw = readUtf8(rel);
  const failures = [];

  if (!/doc_pack:\s*VERIFIED_SCAFFOLD/.test(raw)) {
    failures.push("truth must declare doc_pack VERIFIED_SCAFFOLD until closure");
  }
  if (/VERIFIED_BEHAVIORAL.*9\.8.*closed/i.test(raw)) {
    failures.push("premature 9.8 VERIFIED_BEHAVIORAL claim");
  }

  const specNames = [
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
  for (const name of specNames) {
    if (!exists(`docs/phase-9/subphases/${name}`)) {
      failures.push(`missing subphase spec ${name}`);
    }
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP9EntryLedger() {
  const rel = "reports/phase-9-entry-verified.yaml";
  if (!exists(rel)) {
    return { ok: false, detail: failToken("p9_entry_ledger_present", `missing ${rel}`) };
  }
  const raw = readUtf8(rel);
  const failures = [];
  if (!/phase_8_gate:/m.test(raw)) failures.push("missing phase_8_gate block");
  if (!/map_35_reviewed:/m.test(raw)) failures.push("missing map_35_reviewed");
  if (!/status:\s*(PENDING|PASS)/m.test(raw)) failures.push("missing status PENDING|PASS");
  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join("; ") : null,
  };
}

/**
 * @returns {{ ok: boolean, detail: string | null }}
 */
export function evaluateP9GateScript() {
  const pkg = JSON.parse(readUtf8("package.json"));
  const script = pkg.scripts?.["phase-9:gate"] ?? "";
  if (!script.includes("phase-8:gate")) {
    return {
      ok: false,
      detail: failToken("p9_phase9_gate_script", "phase-9:gate must chain phase-8:gate"),
    };
  }
  if (!script.includes("phase-9:guard")) {
    return {
      ok: false,
      detail: failToken("p9_phase9_gate_script", "phase-9:guard missing from phase-9:gate"),
    };
  }
  return { ok: true, detail: null };
}
