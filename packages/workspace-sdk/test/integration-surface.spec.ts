import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateIntegrationSurface,
  type WorkspaceIntegrationSurface,
} from "../src/operator/integrations/workspace-integration-surface";

describe("workspace integration surface", () => {
  it("validates a minimal provider surface", () => {
    const surface: WorkspaceIntegrationSurface = {
      manifestVersion: 1,
      providers: [
        {
          id: "telegram",
          configFields: [{ id: "channelId", kind: "string", requiredOnCreate: true }],
          credentialFields: [{ id: "botToken", kind: "secret", requiredOnCreate: true }],
          defaultCapabilities: ["message.send"],
          defaultEventPolicies: [{ eventType: "TourCreated", enabled: true }],
          eventMappings: [{ eventType: "TourCreated", capability: "message.send" }],
        },
      ],
    };
    assert.doesNotThrow(() => validateIntegrationSurface(surface));
  });

  it("rejects duplicate provider ids", () => {
    const surface: WorkspaceIntegrationSurface = {
      manifestVersion: 1,
      providers: [
        {
          id: "telegram",
          configFields: [],
          credentialFields: [],
          defaultCapabilities: ["message.send"],
          defaultEventPolicies: [],
          eventMappings: [],
        },
        {
          id: "telegram",
          configFields: [],
          credentialFields: [],
          defaultCapabilities: ["message.send"],
          defaultEventPolicies: [],
          eventMappings: [],
        },
      ],
    };
    assert.throws(
      () => validateIntegrationSurface(surface),
      /INTEGRATION_SURFACE_DUPLICATE_PROVIDER:telegram/
    );
  });
});
