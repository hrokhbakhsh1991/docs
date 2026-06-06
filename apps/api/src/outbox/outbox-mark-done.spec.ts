import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const markDonePath = join(dirname(fileURLToPath(import.meta.url)), "outbox-mark-done.ts");

describe("outbox mark-done terminal timestamps (DEC-084)", () => {
  it("uses SQL now() for processed_at", () => {
    const source = readFileSync(markDonePath, "utf8");
    assert.match(source, /processed_at = now\(\)/);
    assert.doesNotMatch(source, /processedAt:\s*new Date\(\)/);
  });
});
