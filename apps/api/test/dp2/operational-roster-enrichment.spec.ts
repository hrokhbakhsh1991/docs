/**
 * DEC-055 — operational roster enrichment contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function stripTsComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

describe("operational roster enrichment budget contract", () => {
  it("service delegates to budget-safe enrichment helper", () => {
    const service = readFileSync(
      path.join(apiRoot, "src/roster/operational-roster.service.ts"),
      "utf8"
    );
    assert.match(service, /enrichOperationalRosterRowsBudgetSafe/);
    assert.doesNotMatch(
      stripTsComments(service),
      /Promise\.all\s*\(\s*bookings\.items\.map/
    );
  });

  it("enrichment helper serializes per-booking finance fan-out", () => {
    const enrichment = readFileSync(
      path.join(apiRoot, "src/roster/operational-roster-enrichment.ts"),
      "utf8"
    );
    const body = stripTsComments(enrichment);
    assert.match(enrichment, /export async function enrichOperationalRosterRowsBudgetSafe/);
    assert.match(body, /for \(const booking of bookings\)/);
    assert.doesNotMatch(body, /Promise\.all/);
  });
});
