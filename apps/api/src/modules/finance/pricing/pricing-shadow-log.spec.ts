import assert from "node:assert/strict";
import test from "node:test";
import { logPricingShadowDiff } from "./pricing-shadow-log";

test("logPricingShadowDiff emits PRICING_SHADOW_DIFF structured payload", () => {
  const lines: string[] = [];
  const logger = { log: (m: string) => void lines.push(m) };
  logPricingShadowDiff(logger, {
    tenant_id: "t1",
    tour_id: "tour1",
    departure_id: "dep1",
      legacy: {
      line_items: [],
      total: "100",
      pricing_version: "pe-1:v",
      pricing_rule_version: "pe-1:v",
      currency_code: "USD"
    },
    finance: {
      line_items: [],
      total_minor: "90",
      currency_code: "USD",
      pricing_rule_version: "fp:v"
    }
  });
  assert.equal(lines.length, 1);
  const row = JSON.parse(lines[0]!) as { event: string; delta_minor: string; totals_match: boolean };
  assert.equal(row.event, "PRICING_SHADOW_DIFF");
  assert.equal(row.totals_match, false);
  assert.equal(row.delta_minor, "10");
});
