/**
 * Phase 0 Zero-Debt Covenant (H-06) — subprocess-isolated contract aggregator (UT-01).
 * Run via `pnpm run test:phase-0` only. No side-effect spec imports (no shared ESM cache).
 */
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildPhase0ChildEnv } from "./lib/phase-0-test-env.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUN_CONTRACT = path.join(PKG_ROOT, "test/lib/run-contract-subprocess.mjs");

/** MAP §12 / KS-01 — foundation gate runs ONLY this file (via test:phase-0). */
export const PHASE_0_ZERO_DEBT_COVENANT = [
  {
    id: "dist-surface",
    title: "Dist publish surface",
    specRel: "test/contract.spec.ts",
  },
  {
    id: "denali-coupling",
    title: "Denali coupling (depcruise no-denali-product-ids)",
    specRel: "test/denali-coupling.contract.spec.ts",
  },
  {
    id: "legacy-import",
    title: "Legacy import (foundation scope)",
    specRel: "test/legacy-import.contract.spec.ts",
  },
  {
    id: "invariant-manifest",
    title: "Behavioral invariant manifest",
    specRel: "test/invariant-manifest.contract.spec.ts",
  },
  {
    id: "import-purity",
    title: "Barrel import purity (no eager CASL)",
    specRel: "test/import-purity.spec.ts",
  },
  {
    id: "ingress-error",
    title: "Ingress error taxonomy (SdkResult + typed sanitization)",
    specRel: "test/ingress-error.contract.spec.ts",
  },
  {
    id: "theme-safety-seal",
    title: "Theme safety seal contract",
    specRel: "test/theme-safety-seal.contract.spec.ts",
  },
  {
    id: "foundation-import-purity",
    title: "Foundation import purity AST audit",
    specRel: "test/foundation-import-purity.contract.spec.ts",
  },
  {
    id: "denali-workspace-binding",
    title: "Denali workspace type resolves to null (Phase 6)",
    specRel: "test/denali-workspace-binding.contract.spec.ts",
  },
  {
    id: "supplemental-behavior",
    title: "Adversarial ingress + storage + auth + theme contracts",
    specRel: "test/phase-0-supplemental.contract.spec.ts",
  },
] as const;

/** @deprecated Use PHASE_0_ZERO_DEBT_COVENANT */
export const PHASE_0_CLOSURE_CONTRACTS = PHASE_0_ZERO_DEBT_COVENANT;

function runContractInSubprocess(specRel: string): { ok: boolean; detail: string } {
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

  return {
    ok: false,
    detail: out.slice(-4000) || `exit ${r.status ?? "unknown"}`,
  };
}

describe("phase 0 zero-debt covenant aggregator (H-06)", () => {
  it("requires exactly ten contract modules", () => {
    assert.equal(PHASE_0_ZERO_DEBT_COVENANT.length, 10);
    assert.deepEqual(
      PHASE_0_ZERO_DEBT_COVENANT.map((contract) => contract.id),
      [
        "dist-surface",
        "denali-coupling",
        "legacy-import",
        "invariant-manifest",
        "import-purity",
        "ingress-error",
        "theme-safety-seal",
        "foundation-import-purity",
        "denali-workspace-binding",
        "supplemental-behavior",
      ],
    );
  });

  for (const contract of PHASE_0_ZERO_DEBT_COVENANT) {
    it(`contract passes in isolated subprocess: ${contract.id}`, () => {
      const { ok, detail } = runContractInSubprocess(contract.specRel);
      assert.equal(ok, true, `${contract.id} (${contract.specRel}) failed:\n${detail}`);
    });
  }

  it("all contracts pass when run in reverse manifest order (no order dependence)", () => {
    const reversed = [...PHASE_0_ZERO_DEBT_COVENANT].reverse();
    for (const contract of reversed) {
      const { ok, detail } = runContractInSubprocess(contract.specRel);
      assert.equal(
        ok,
        true,
        `reverse order failed at ${contract.id}:\n${detail}`,
      );
    }
  });
});
