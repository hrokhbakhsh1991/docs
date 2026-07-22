import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DraftSchemaGate } from "@app-tour/draft-engine";

import { createDeferredDraftSchemaGate } from "../src/draft/create-deferred-draft-schema-gate";

describe("createDeferredDraftSchemaGate", () => {
  it("passes through until the ref is populated", () => {
    const gateRef: { current: DraftSchemaGate<{ n: number }> | null } = { current: null };
    const gate = createDeferredDraftSchemaGate(gateRef);
    const result = gate({ n: 1 }, { source: "local" } as never);
    assert.deepEqual(result, { ok: true, value: { n: 1 } });
  });

  it("delegates to the active gate when set", () => {
    const gateRef: { current: DraftSchemaGate<{ n: number }> | null } = {
      current: (candidate) => ({ ok: false, issues: [{ path: "n", message: "bad" }] as never }),
    };
    const gate = createDeferredDraftSchemaGate(gateRef);
    const result = gate({ n: 2 }, { source: "local" } as never);
    assert.equal(result.ok, false);
  });
});
