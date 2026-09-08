/**
 * DEC-055 — operational roster enrichment contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("operational roster enrichment budget contract", () => {
  it("service delegates to budget-safe enrichment helper", () => {
    const service = readFileSync(
      path.join(apiRoot, "src/roster/operational-roster.service.ts"),
      "utf8"
    );
    assert.match(service, /enrichOperationalRosterRowsBudgetSafe/);
    assert.doesNotMatch(service, /Promise\.all\s*\(\s*bookings\.items\.map/);
  });

  it("enrichment helper serializes per-booking finance fan-out", () => {
    const enrichment = readFileSync(
      path.join(apiRoot, "src/roster/operational-roster-enrichment.ts"),
      "utf8"
    );
    assert.match(enrichment, /for \(const booking of bookings\)/);
    assert.doesNotMatch(enrichment, /Promise\.all/);
  });
});
