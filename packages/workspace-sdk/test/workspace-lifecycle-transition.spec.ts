import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWorkspaceLifecycleTransitionAllowed,
  isWorkspaceUnpublishTransitionAllowed,
} from "../src/plugin/workspace-lifecycle-transition";
import type { WorkspaceLifecycleContract } from "../src/plugin/workspace-lifecycle";

const DENALI_LIFECYCLE: WorkspaceLifecycleContract = {
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
};

describe("workspace-lifecycle-transition.spec.ts", () => {
  it("SDK-LC-01 allows declared transitions", () => {
    assert.equal(isWorkspaceLifecycleTransitionAllowed(DENALI_LIFECYCLE, "DRAFT", "OPEN"), true);
    assert.equal(isWorkspaceLifecycleTransitionAllowed(DENALI_LIFECYCLE, "OPEN", "DRAFT"), false);
    assert.equal(isWorkspaceLifecycleTransitionAllowed(DENALI_LIFECYCLE, "DRAFT", "DRAFT"), true);
  });

  it("SDK-LC-02 unpublish follows publish → initial edge", () => {
    assert.equal(isWorkspaceUnpublishTransitionAllowed(DENALI_LIFECYCLE), false);
    assert.equal(
      isWorkspaceUnpublishTransitionAllowed({
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [
          { from: "DRAFT", to: "OPEN" },
          { from: "OPEN", to: "DRAFT" },
        ],
      }),
      true
    );
    assert.equal(isWorkspaceUnpublishTransitionAllowed(undefined), false);
  });
});
