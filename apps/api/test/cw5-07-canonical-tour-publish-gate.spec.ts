import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_LIFECYCLE } from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { assertTourPublishLifecycleOnUpdate } from "../src/canonical/assert-tour-publish-lifecycle-gate";
import {
  assertCanonicalTourWritePublishGate,
} from "../src/canonical/canonical-tour-publish-orchestration";
import { isTourLifecycleTransitionError } from "../src/canonical/assert-tour-lifecycle-transition.ts";
import { readTourPublishStatusLabel } from "../src/canonical/workspace-canonical-tour-dispatch.ts";

function denaliCanonical(publishStatus: string) {
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: ["publishStatus", "basicInfo"],
    data: {
      publishStatus,
      basicInfo: { publishStatus, title: "Alpine day" },
    },
  });
}

describe("CW5-07 canonical tour write publish gate", () => {
  it("CW5-07-01 orchestration matches assertTourPublishLifecycleOnUpdate for denali draft→active", () => {
    const before = denaliCanonical("draft");
    const after = denaliCanonical("active");
    const input = {
      workspaceType: "denali",
      lifecycle: DENALI_LIFECYCLE,
      before,
      after,
    };
    assert.doesNotThrow(() => assertCanonicalTourWritePublishGate(input));
    assert.doesNotThrow(() => assertTourPublishLifecycleOnUpdate(input));
    assert.equal(readTourPublishStatusLabel("denali", after), "active");
  });

  it("CW5-07-02 orchestration rejects illegal denali active→draft unpublish", () => {
    const input = {
      workspaceType: "denali",
      lifecycle: DENALI_LIFECYCLE,
      before: denaliCanonical("active"),
      after: denaliCanonical("draft"),
    };
    assert.throws(
      () => assertCanonicalTourWritePublishGate(input),
      (error: unknown) => {
        assert.ok(isTourLifecycleTransitionError(error));
        return true;
      },
    );
    assert.throws(() => assertTourPublishLifecycleOnUpdate(input));
  });
});
