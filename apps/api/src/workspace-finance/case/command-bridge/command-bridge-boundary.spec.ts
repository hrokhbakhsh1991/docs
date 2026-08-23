import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const COMMAND_BRIDGE_FILES = [
  "map-case-command-intent.ts",
  "finance-service-review-receipt-adapter.ts",
] as const;

describe("finance case command bridge boundary", () => {
  it("keeps shared SoT-port guidance workspace-generic", () => {
    for (const file of COMMAND_BRIDGE_FILES) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), {
        encoding: "utf8",
      });
      assert.doesNotMatch(source, /Denali uses FinanceService\.reviewReceipt/);
      assert.doesNotMatch(source, /Denali binds FinanceService/);
      assert.doesNotMatch(source, /Denali uses this adapter/);
    }
  });
});
