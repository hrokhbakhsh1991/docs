/**
 * Post-create wizard redirect + draft cleanup (WEB-P11-6-03)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runCreateTourPostSubmitSuccess } from "../src/tours/run-create-tour-post-submit-success";

describe("run-create-tour-post-submit-success.spec.ts", () => {
  it("WEB-P11-6-03 navigates to tours list and discards remote draft in background", async () => {
    const navigated: string[] = [];
    let clearCalls = 0;
    let clearResolved = false;

    runCreateTourPostSubmitSuccess({
      tourId: "0ad5e8ce-baa9-49fc-9344-c18ee669e7b2",
      navigate: (url) => {
        navigated.push(url);
      },
      discardRemoteDraft: async () => {
        clearCalls += 1;
        clearResolved = true;
      },
    });

    assert.deepEqual(navigated, [
      "/tours?created=0ad5e8ce-baa9-49fc-9344-c18ee669e7b2",
    ]);
    assert.equal(clearCalls, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(clearResolved, true);
  });
});
