import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createIntegrationPolicyEngine } from "./integration-policy-engine";
import type { IntegrationPolicyRepository } from "../infrastructure/integration-policy.repository";

describe("integration-policy-engine", () => {
  it("skips connections when event policy is disabled", async () => {
    const repository: IntegrationPolicyRepository = {
      async listEnabledConnectionsForScope() {
        return [
          {
            connectionId: "conn-1",
            tenantId: "tenant-a",
            provider: "telegram",
            workspaceType: "denali",
            capabilities: ["message.send"],
            config: { channelId: "@chan" },
            credentials: {},
            secretRef: "ref-1",
          },
        ];
      },
      async listPoliciesForConnection() {
        return [
          {
            id: "p1",
            tenantId: "tenant-a",
            integrationConnectionId: "conn-1",
            eventType: "TourCreated",
            enabled: false,
          },
        ];
      },
      async isEventEnabledForConnection() {
        return false;
      },
    };

    const engine = createIntegrationPolicyEngine({ policyRepository: repository });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 0);
  });

  it("enqueues capabilities when policy enabled", async () => {
    const repository: IntegrationPolicyRepository = {
      async listEnabledConnectionsForScope() {
        return [
          {
            connectionId: "conn-1",
            tenantId: "tenant-a",
            provider: "telegram",
            workspaceType: "denali",
            capabilities: ["message.send"],
            config: {},
            credentials: {},
            secretRef: null,
          },
        ];
      },
      async listPoliciesForConnection() {
        return [
          {
            id: "p1",
            tenantId: "tenant-a",
            integrationConnectionId: "conn-1",
            eventType: "TourCreated",
            enabled: true,
          },
        ];
      },
      async isEventEnabledForConnection() {
        return true;
      },
    };

    const engine = createIntegrationPolicyEngine({ policyRepository: repository });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 1);
    assert.ok(decisions.some((d) => d.capability === "message.send"));
    assert.ok(!decisions.some((d) => d.capability === "channel.create"));
  });

  it("allows legacy telegram without policy rows", async () => {
    const repository: IntegrationPolicyRepository = {
      async listEnabledConnectionsForScope() {
        return [
          {
            connectionId: "legacy-telegram:abc",
            tenantId: "tenant-a",
            provider: "telegram",
            workspaceType: "denali",
            capabilities: ["message.send"],
            config: { channelId: "@legacy" },
            credentials: { botToken: "x" },
            secretRef: null,
          },
        ];
      },
      async listPoliciesForConnection() {
        return [];
      },
      async isEventEnabledForConnection() {
        return false;
      },
    };

    const engine = createIntegrationPolicyEngine({ policyRepository: repository });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 1);
  });
});
