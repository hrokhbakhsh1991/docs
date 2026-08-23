import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("finance case encounter boundary comments", () => {
  it("keeps shared encounter loader guidance workspace-generic", () => {
    const loader = readFileSync(new URL("./load-finance-case-encounter-http.ts", import.meta.url), {
      encoding: "utf8",
    });
    const rollout = readFileSync(new URL("./finance-case-encounter-rollout.ts", import.meta.url), {
      encoding: "utf8",
    });
    assert.doesNotMatch(loader, /defaults to live Denali presentation loader/);
    assert.doesNotMatch(loader, /live Denali stack/);
    assert.match(loader, /live workspace Case stack/);
    assert.doesNotMatch(rollout, /Explicit Denali operator rollout strategy/);
    assert.match(rollout, /Explicit operator rollout strategy/);
  });
});
