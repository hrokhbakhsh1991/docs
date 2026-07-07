import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("guard-catch-error-leak passes on full apps/api/src tree", () => {
  const result = spawnSync("node", ["scripts/guards/guard-catch-error-leak.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("guard-api-workspace-isolation passes on clean tree", () => {
  const result = spawnSync("node", ["scripts/guards/guard-api-workspace-isolation.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
