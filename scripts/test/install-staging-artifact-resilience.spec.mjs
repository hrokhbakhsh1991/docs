/**
 * Staging artifact install — transactional cutover + seed-failure resilience locks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function lineNo(source, needle) {
  const idx = source.indexOf(needle);
  assert.notEqual(idx, -1, `missing: ${needle}`);
  return source.slice(0, idx).split("\n").length;
}

describe("install-staging-artifact resilience", () => {
  const sh = read("scripts/vps-deploy/install-staging-artifact.sh");

  it("STAGING-INSTALL-01 seed runs before service stop (failed seed keeps prior stack up)", () => {
    const seedLine = lineNo(sh, 'log "seed staging (synthetic operator/Denali)"');
    const stopLine = lineNo(sh, 'log "stop staging units (post-seed cutover)"');
    assert.ok(seedLine < stopLine, "seed must precede stop");
  });

  it("STAGING-INSTALL-02 ERR trap restores previous release after post-stop failure", () => {
    assert.match(sh, /trap restore_previous_stack_on_failure ERR/);
    assert.match(sh, /restore_previous_stack_on_failure/);
    assert.match(sh, /start-staging-artifact-stack\.sh/);
    assert.match(sh, /SERVICES_STOPPED=true/);
    assert.match(sh, /ln -sfn "\$PREVIOUS_CURRENT"/);
  });

  it("STAGING-INSTALL-03 pre-stop failure exits without restore restart", () => {
    assert.match(sh, /active stack left running/);
  });
});
