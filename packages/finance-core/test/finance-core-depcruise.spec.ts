/**
 * Phase 2.2.2 — dependency-cruiser finance-core rules + negative fixture proof.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = resolve(PKG, "../..");
const SRC = join(PKG, "src");
const FIXTURE = join(PKG, "test/fixtures/illegal-prisma-import.ts");
const CRUISE_HELPER = join(PKG, "test/cruise-finance-core.mjs");

/**
 * @param {string[]} absTargets
 * @returns {{ status: number | null, errors: Array<{ rule?: { name?: string }, from?: string, to?: string }> }}
 */
function cruiseFinanceCore(absTargets) {
  const r = spawnSync(process.execPath, [CRUISE_HELPER, ...absTargets], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = (r.stdout ?? "").trim();
  if (!stdout.startsWith("[")) {
    throw new Error(
      `depcruise helper failed (exit ${r.status}): ${(r.stderr ?? stdout).trim()}`
    );
  }
  return { status: r.status, errors: JSON.parse(stdout) };
}

describe("FIN-P2.2.2 finance-core dependency-cruiser", () => {
  it("production src has zero finance-core-* violations", () => {
    assert.equal(existsSync(SRC), true);
    const { errors } = cruiseFinanceCore([SRC]);
    assert.equal(
      errors.length,
      0,
      `unexpected finance-core violations:\n${JSON.stringify(errors, null, 2)}`
    );
  });

  it("illegal-prisma-import fixture fails finance-core-no-prisma", () => {
    assert.equal(existsSync(FIXTURE), true, `missing fixture: ${FIXTURE}`);
    const src = readFileSync(FIXTURE, "utf8");
    assert.match(src, /@prisma\/client/);

    const { status, errors } = cruiseFinanceCore([FIXTURE]);
    assert.notEqual(status, 0, "fixture cruise must exit non-zero");
    const prismaHits = errors.filter((e) => e.rule?.name === "finance-core-no-prisma");
    assert.ok(
      prismaHits.length > 0,
      `expected finance-core-no-prisma from fixture; got: ${JSON.stringify(errors)}`
    );
  });
});
