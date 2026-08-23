import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCanTransitionState,
  canTransitionState,
  type TransitionTable,
} from "../src/transition/transition-table";

type DemoStatus = "a" | "b" | "c";

const DEMO_TABLE: TransitionTable<DemoStatus> = {
  a: ["b", "c"],
  b: ["c"],
  c: [],
};

describe("transition-table (CW5-06)", () => {
  it("rejects self and terminal outbound transitions", () => {
    assert.equal(canTransitionState(DEMO_TABLE, "a", "a"), false);
    assert.equal(canTransitionState(DEMO_TABLE, "c", "a", ["c"]), false);
    assert.equal(canTransitionState(DEMO_TABLE, "a", "b"), true);
  });

  it("assertCanTransitionState throws on illegal edge", () => {
    assert.throws(() => assertCanTransitionState(DEMO_TABLE, "c", "a", ["c"]));
  });
});
