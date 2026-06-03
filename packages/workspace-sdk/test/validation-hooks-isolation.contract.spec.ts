import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tryParseWorkspacePluginFromStorage } from "../src/index.js";
import { createFreshStarterPlugin } from "./lib/immutable-harness.js";

describe("validation hooks isolation (CRIT-STATE-02)", () => {
  it("mutating hooks on one ingress parse does not affect the next parse", () => {
    const raw = JSON.parse(JSON.stringify(createFreshStarterPlugin())) as Record<string, unknown>;
    const first = tryParseWorkspacePluginFromStorage(raw);
    assert.equal(first.ok, true);
    if (!first.ok) return;

    (first.value.validation as { checkCapacity: () => null }).checkCapacity = () => ({
      code: "MUTATED",
      message: "mutated",
    });

    const second = tryParseWorkspacePluginFromStorage(raw);
    assert.equal(second.ok, true);
    if (!second.ok) return;

    assert.equal(second.value.validation.checkCapacity(1), null);
  });
});
