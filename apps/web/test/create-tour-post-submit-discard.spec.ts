import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCreateTourPostSubmitDiscardRemoteDraft } from "../src/tours/create-tour-post-submit-discard";

describe("create-tour-post-submit-discard.spec.ts", () => {
  it("WEB-P11-6-09 factory binds workspace draft delete args", () => {
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 204 });
    };

    try {
      const discard = createCreateTourPostSubmitDiscardRemoteDraft({
        workspaceId: "ws-1",
        namespace: "operator.wizard",
        draftKey: "denali-create",
      });
      void discard();
      assert.equal(calls.length, 1);
      assert.match(calls[0] ?? "", /operator\.wizard/);
      assert.match(calls[0] ?? "", /denali-create/);
    } finally {
      globalThis.fetch = original;
    }
  });
});
