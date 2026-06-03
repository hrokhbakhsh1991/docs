/**
 * Phase 0 supplemental behavior specs (FC-TEST-08) — subprocess isolation per file.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildPhase0ChildEnv } from "./lib/phase-0-test-env.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN_CONTRACT = path.join(PKG_ROOT, "test/lib/run-contract-subprocess.mjs");

const SUPPLEMENTAL_SPECS = [
  "test/adversarial-canonical-ingress.spec.ts",
  "test/storage-ingress-immutability.spec.ts",
  "test/auth/ability.spec.ts",
  "test/theme-validation.contract.spec.ts",
  "test/validation-hooks-isolation.contract.spec.ts",
] as const;

function runSpecInSubprocess(specRel: string): { ok: boolean; detail: string } {
  const r = spawnSync(process.execPath, [RUN_CONTRACT, specRel], {
    cwd: PKG_ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: buildPhase0ChildEnv(),
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();
  if (r.status === 0 && out.includes("CONTRACT_SUBPROCESS_OK")) {
    return { ok: true, detail: "" };
  }
  return { ok: false, detail: out.slice(-4000) || `exit ${r.status ?? "unknown"}` };
}

describe("phase 0 supplemental behavior contracts", () => {
  for (const specRel of SUPPLEMENTAL_SPECS) {
    it(`supplemental spec passes in subprocess: ${specRel}`, () => {
      const { ok, detail } = runSpecInSubprocess(specRel);
      assert.equal(ok, true, `${specRel} failed:\n${detail}`);
    });
  }
});
