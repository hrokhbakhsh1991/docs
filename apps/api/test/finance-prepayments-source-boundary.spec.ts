import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("finance-prepayments source boundary", () => {
  it("does not invent a workspace currency when reading legacy prepayment payloads", () => {
    const source = readFileSync(
      new URL(
        "../src/workspace-finance/infrastructure/prisma-finance.repository.ts",
        import.meta.url
      ),
      "utf8"
    );

    assert.match(source, /currency: String\(payload\.currency \?\? ""\)/);
    assert.doesNotMatch(source, /currency: String\(payload\.currency \?\? "IRR"\)/);
  });
});
