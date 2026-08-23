import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const SOURCE = join(
  import.meta.dirname,
  "../src/workspace-finance/tour-created-paid-ledger-exclusive.ts"
);

describe("tour-created-paid-ledger-exclusive boundary", () => {
  it("does not invent a platform currency before materializing the ledger", () => {
    const source = readFileSync(SOURCE, "utf8");
    assert.doesNotMatch(source, /currency\s*=\s*input\.currency\.trim\(\)\s*\|\|\s*"USD"/);
    assert.match(source, /if\s*\([^)]*!currency/);
  });
});
