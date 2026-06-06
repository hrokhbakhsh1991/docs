import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readCanonicalTransactionNow } from "./canonical-transaction-now";

describe("readCanonicalTransactionNow (DEC-077)", () => {
  it("returns Date from transaction-scoped SELECT now()", async () => {
    const expected = new Date("2026-06-05T12:00:00.000Z");
    const tx = {
      $queryRaw: async () => [{ ts: expected }],
    };

    const actual = await readCanonicalTransactionNow(tx as never);
    assert.equal(actual, expected);
  });

  it("throws when DB snapshot is missing or invalid", async () => {
    await assert.rejects(
      () =>
        readCanonicalTransactionNow({
          $queryRaw: async () => [],
        } as never),
      /CANONICAL_TX_NOW_INVALID/
    );

    await assert.rejects(
      () =>
        readCanonicalTransactionNow({
          $queryRaw: async () => [{ ts: "not-a-date" }],
        } as never),
      /CANONICAL_TX_NOW_INVALID/
    );
  });
});
