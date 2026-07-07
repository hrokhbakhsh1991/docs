/**
 * PF-3.1 — guard-guest-consumer-deps catches missing workspace package wiring.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("guard-guest-consumer-deps", () => {
  it("PASS on trunk with guest-club wired", () => {
    const result = spawnSync("node", ["scripts/guards/guard-guest-consumer-deps.mjs"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout ?? "", /guard-guest-consumer-deps: PASS/);
  });
});
