import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeWorkspaceBundleFingerprint } from "../src/workspace-bundle-fingerprint";

describe("workspace bundle fingerprint (MAT-010)", () => {
  const base = {
    workspaceBindingId: "tenant-a:denali",
    workspaceType: "denali",
    manifestFingerprint: "manifest-fp-1",
    profilePin: { id: "starter-outdoor", profileVersion: 1 },
    capabilityPins: { workspaceTransport: { revision: 1 } },
    workspacePolicyBindingId: "denali-policy-v1",
    brandingConfigHash: "brand-hash-1",
    placement: { mode: "SHARED" as const, region: "eu-central" },
    releaseSha: "abc123",
  };

  it("is deterministic for the same bundle input", () => {
    const first = computeWorkspaceBundleFingerprint(base);
    const second = computeWorkspaceBundleFingerprint({ ...base });
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
  });

  it("changes when placement mode changes", () => {
    const shared = computeWorkspaceBundleFingerprint(base);
    const dedicated = computeWorkspaceBundleFingerprint({
      ...base,
      placement: { mode: "DEDICATED_DB", region: "eu-central", databaseTargetId: "db-a" },
    });
    assert.notEqual(shared, dedicated);
  });
});
