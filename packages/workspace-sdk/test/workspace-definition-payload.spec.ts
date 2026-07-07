import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWorkspaceDefinitionPayload,
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  stripWorkspacePluginToDefinitionPayload,
  validateWorkspaceDefinitionPayload,
} from "../src/metadata/index.js";
import { computeWorkspaceDefinitionPayloadChecksum } from "../src/metadata/workspace-definition-payload-checksum.js";
import { isWorkspaceSdkValidationError } from "../src/index.js";
import { createFreshStarterPlugin } from "./lib/immutable-harness.js";

describe("validateWorkspaceDefinitionPayload", () => {
  it("accepts stripped starter plugin payload", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const result = validateWorkspaceDefinitionPayload(payload);
    assert.equal(result.ok, true);
    assert.doesNotThrow(() => assertWorkspaceDefinitionPayload(payload));
  });

  it("rejects validation hooks in payload", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const bad = {
      ...payload,
      validation: { checkCapacity: () => true, checkTripDetails: () => true },
    };
    const result = validateWorkspaceDefinitionPayload(bad);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "PLUGIN_FUNCTION_NOT_ALLOWED");
  });

  it("rejects lifecycle block in payload", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const bad = {
      ...payload,
      lifecycle: {
        initialStatus: "DRAFT",
        publishStatus: "OPEN",
        allowedTransitions: [],
      },
    };
    assert.throws(
      () => assertWorkspaceDefinitionPayload(bad),
      (error: unknown) => {
        assert.ok(isWorkspaceSdkValidationError(error));
        assert.equal(error.code, "PLUGIN_FUNCTION_NOT_ALLOWED");
        return true;
      },
    );
  });

  it("accepts optional commerce block on payload", () => {
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin()),
      commerce: DEFAULT_WORKSPACE_COMMERCE_CONFIG,
    };
    const result = validateWorkspaceDefinitionPayload(payload);
    assert.equal(result.ok, true);
  });

  it("rejects invalid commerce block on payload", () => {
    const payload = {
      ...stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin()),
      commerce: { paymentMode: "gateway", gatewayProvider: null, currency: "IRR" },
    };
    const result = validateWorkspaceDefinitionPayload(payload);
    assert.equal(result.ok, false);
  });

  it("checksum is stable for same payload", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const a = computeWorkspaceDefinitionPayloadChecksum(payload);
    const b = computeWorkspaceDefinitionPayloadChecksum(payload);
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  it("checksum changes when commerce content changes", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const base = computeWorkspaceDefinitionPayloadChecksum({
      ...payload,
      commerce: DEFAULT_WORKSPACE_COMMERCE_CONFIG,
    });
    const mutated = {
      ...payload,
      commerce: {
        paymentMode: "gateway" as const,
        gatewayProvider: "zibal" as const,
        currency: "IRR",
      },
    };
    assert.notEqual(base, computeWorkspaceDefinitionPayloadChecksum(mutated));
  });

  it("checksum changes when registry content changes", () => {
    const payload = stripWorkspacePluginToDefinitionPayload(createFreshStarterPlugin());
    const base = computeWorkspaceDefinitionPayloadChecksum(payload);
    const mutated = {
      ...payload,
      fieldRegistry: {
        ...payload.fieldRegistry,
        fields: [
          ...payload.fieldRegistry.fields,
          {
            id: "checksum.test.field",
            canonicalPath: "basics.checksumTest",
            stepId: payload.wizard.roots[0] ?? "basics",
            kind: "text" as const,
            required: false,
          },
        ],
      },
    };
    assert.notEqual(base, computeWorkspaceDefinitionPayloadChecksum(mutated));
  });
});
