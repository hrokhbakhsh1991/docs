import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveTourProjections } from "../canonical/projection-sync";

describe("reconcile tour projection helpers (DEC-115)", () => {
  it("deriveTourProjections matches canonical basics title", () => {
    const canonical = {
      schemaVersion: 2,
      roots: ["basics"],
      data: { basics: { title: "auto-repair" } },
    };
    const projections = deriveTourProjections(canonical);
    assert.equal(projections.title, "auto-repair");
    assert.equal(projections.schemaVersion, 2);
  });
});
