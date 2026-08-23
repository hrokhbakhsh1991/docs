import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertGoldenParity, fixturePath, loadFixture } from "./lib/golden-harness.mjs";
import { stableStringify } from "./lib/stable-json.mjs";

describe("parity harness self-test (CW0-01)", () => {
  it("stableStringify is byte-stable across repeated serialization", () => {
    const value = { b: 2, a: 1, nested: { z: 3, m: 2 } };
    const first = stableStringify(value);
    const second = stableStringify(JSON.parse(first));
    assert.equal(first, second);
  });

  it("assertGoldenParity replays fixture input to expected output", () => {
    const fixture = loadFixture(fixturePath("harness/roundtrip.json"));
    assertGoldenParity({
      id: fixture.id,
      fixturePath: fixturePath("harness/roundtrip.json"),
      run: (input) => {
        const typed = /** @type {{ readonly values: readonly number[] }} */ (input);
        return {
          sum: typed.values.reduce((acc, n) => acc + n, 0),
          count: typed.values.length,
        };
      },
    });
  });
});
