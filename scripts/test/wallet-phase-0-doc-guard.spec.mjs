/**
 * Phase 0 — Wallet documentation contract guard (no runtime Wallet code).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const GUARD = join(REPO_ROOT, "scripts/guards/guard-wallet-phase-0-doc.mjs");

describe("wallet-phase-0-doc-guard.spec.mjs", () => {
  it("WALLET-P0-DOC-01 guard-wallet-phase-0-doc passes", () => {
    const result = spawnSync(process.execPath, [GUARD], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `guard failed:\n${result.stdout}\n${result.stderr}`
    );
    assert.match(result.stdout, /guard-wallet-phase-0-doc: PASS/);
  });
});
