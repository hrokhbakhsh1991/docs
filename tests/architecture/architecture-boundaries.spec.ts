/**
 * Phase 4 — Infrastructure Hardening: automated architectural boundary enforcement.
 *
 * Rules:
 * 1. `domain` MUST NOT import from `app` or `infra`.
 * 2. `app` MAY import `domain`; MUST NOT import `infra`.
 * 3. `infra` MAY import `domain` and `app`.
 * 4. Cross–bounded-context relative imports are forbidden (use ports/adapters or packages).
 *
 * Layer resolution uses canonical `modules/{context}/{domain,app,infra}/` paths and a
 * documented legacy map for transitional folders (`entities/`, `application/`, etc.).
 *
 * @see MAP §62
 * @see tests/architecture/boundary-scanner.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  formatViolations,
  scanArchitectureBoundaries,
} from "./boundary-scanner.ts";

test("architecture: scan produces classification stats", () => {
  const { stats } = scanArchitectureBoundaries();
  assert.ok(stats.filesScanned > 0, "expected API module files to scan");
  assert.ok(stats.filesClassified > 0, "expected classifiable module files");
  assert.ok(
    stats.filesClassified <= stats.filesScanned,
    "classified files are a subset of scanned module files"
  );
  assert.equal(
    stats.byLayer.domain + stats.byLayer.app + stats.byLayer.infra,
    stats.filesClassified,
    "layer counts sum to classified file count"
  );
});

test("architecture: domain layer does not import infra (batch 1)", () => {
  const { violations } = scanArchitectureBoundaries();
  const infraViolations = violations.filter((v) => v.kind === "domain-must-not-import-infra");

  assert.equal(
    infraViolations.length,
    0,
    `expected zero domain→infra violations; got ${infraViolations.length}: ${infraViolations
      .slice(0, 5)
      .map((v) => `${v.file}:${v.line}`)
      .join(", ")}`
  );
});

test("architecture: module layer and bounded-context dependency rules", () => {
  const { violations, stats } = scanArchitectureBoundaries();

  process.stderr.write(
    `\n${formatViolations(violations)}\n` +
      `Scan stats: ${JSON.stringify(stats)}\n` +
      `Refactor offenders incrementally; see MAP §62.\n` +
      (process.env.ARCHITECTURE_BOUNDARIES_ENFORCE === "1"
        ? "ARCHITECTURE_BOUNDARIES_ENFORCE=1 — failing on violations.\n\n"
        : "Report-only (suite passes). Run: pnpm --filter @apps/api test:architecture:enforce\n\n")
  );

  if (process.env.ARCHITECTURE_BOUNDARIES_ENFORCE === "1") {
    assert.equal(
      violations.length,
      0,
      `${violations.length} architecture boundary violation(s) — see stderr for grouped report`
    );
  }
});
