import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CAPABILITY_REVISION,
  parseWorkspaceVersionPinsFromTheme,
  readCapabilityBlockRevision,
  readProfileCatalogVersion,
  resolveEffectiveCapabilityRevision,
  resolveEffectiveProfileVersion,
  runWorkspaceUpgradePreflight,
} from "../src/manifest/workspace-versioning";

describe("workspace-versioning (MAT-001)", () => {
  it("resolves capability revision deterministically with pin precedence", () => {
    const pinned = resolveEffectiveCapabilityRevision({
      capabilityId: "workspaceTransport",
      manifestRevision: 2,
      supportedRevisions: [1, 2],
      pin: { revision: 1 },
    });
    assert.deepEqual(pinned, { revision: 1 });

    const manifest = resolveEffectiveCapabilityRevision({
      capabilityId: "workspaceTransport",
      manifestRevision: 2,
      supportedRevisions: [1, 2],
    });
    assert.deepEqual(manifest, { revision: 2 });
  });

  it("fails closed on unknown capability revision", () => {
    const violation = resolveEffectiveCapabilityRevision({
      capabilityId: "workspaceTransport",
      manifestRevision: 1,
      supportedRevisions: [1],
      pin: { revision: 99 },
    });
    assert.equal(violation.code, "WORKSPACE_VERSION_UNSUPPORTED_REVISION");
  });

  it("profile pin keeps workspace on v1 when catalog has v2", () => {
    const resolved = resolveEffectiveProfileVersion({
      profileId: "starter-outdoor",
      catalogVersion: 2,
      supportedVersions: [1, 2],
      pin: { id: "starter-outdoor", profileVersion: 1 },
    });
    assert.deepEqual(resolved, { profileVersion: 1 });
  });

  it("upgrade preflight rejects unknown capability for workspace", () => {
    const result = runWorkspaceUpgradePreflight({
      workspaceType: "urban",
      currentPins: {},
      targetPins: { capabilityPins: { workspaceTransport: { revision: 1 } } },
      capabilityCatalog: { urban: {} },
      profileCatalog: {},
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.violations[0]?.code, "WORKSPACE_VERSION_UNKNOWN_CAPABILITY");
    }
  });

  it("upgrade preflight accepts rollback-compatible pin when revision supported", () => {
    const result = runWorkspaceUpgradePreflight({
      workspaceType: "denali",
      currentPins: { capabilityPins: { workspaceTransport: { revision: 2 } } },
      targetPins: { capabilityPins: { workspaceTransport: { revision: 1 } } },
      capabilityCatalog: { denali: { workspaceTransport: [1, 2] } },
      profileCatalog: {},
    });
    assert.equal(result.ok, true);
  });

  it("parses version pins from tenant theme JSON", () => {
    const pins = parseWorkspaceVersionPinsFromTheme({
      versionPins: {
        profilePin: { id: "starter-outdoor", profileVersion: 1 },
        capabilityPins: { workspaceEquipment: { revision: 1 } },
      },
    });
    assert.deepEqual(pins, {
      profilePin: { id: "starter-outdoor", profileVersion: 1 },
      capabilityPins: { workspaceEquipment: { revision: 1 } },
    });
  });

  it("defaults capability revision to 1 when block omits field", () => {
    assert.equal(readCapabilityBlockRevision({ supported: true }), DEFAULT_CAPABILITY_REVISION);
    assert.equal(readProfileCatalogVersion({}), 1);
  });
});
