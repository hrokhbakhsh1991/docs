import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createIntegrationPolicyEngine,
  resolveIntegrationPolicyExposureCoordinate,
} from "./integration-policy-engine";
import type { IntegrationPolicyRepository } from "../infrastructure/integration-policy.repository";
import type { ExposureIntentRepository } from "../../exposure/exposure-intent.repository";
import { NATIVE_EXPOSURE_INTENT_SOURCE } from "../../exposure/exposure-intent";

const NATIVE_INTENT = {
  id: "native-1",
  profileId: "denali.telegram.TourCreated",
  workspaceType: "denali",
  entityType: "tour",
  surface: "telegram",
  audience: "external_channel",
  trigger: "TourCreated",
  scope: {
    connectionId: "conn-1",
    eventType: "TourCreated",
  },
  mode: "override_fields" as const,
  selectedFieldIds: ["title"],
  templateOverrideId: "New: {{field:title}}",
  source: NATIVE_EXPOSURE_INTENT_SOURCE,
  sourceId: "native-1",
  version: "2026-01-01T00:00:00.000Z",
};

function policyRepositoryStub(
  overrides: Partial<IntegrationPolicyRepository> = {},
): IntegrationPolicyRepository {
  return {
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
      return [];
    },
    async isEventEnabledForConnection() {
      return false;
    },
    async updateEventPolicy() {
      throw new Error("not used");
    },
    ...overrides,
  };
}

function exposureIntentRepositoryStub(
  overrides: Partial<ExposureIntentRepository> = {},
): ExposureIntentRepository {
  return {
    async findForContext() {
      return null;
    },
    async listForConnectionScope() {
      return [];
    },
    async upsert() {
      throw new Error("not used");
    },
    ...overrides,
  };
}

describe("integration-policy-engine", () => {
  it("skips connections when event policy is disabled", async () => {
    const engine = createIntegrationPolicyEngine({
      policyRepository: policyRepositoryStub({
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
      }),
      exposureIntentRepository: exposureIntentRepositoryStub(),
    });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 0);
  });

  it("enqueues capabilities when policy enabled without exposure intent", async () => {
    const engine = createIntegrationPolicyEngine({
      policyRepository: policyRepositoryStub({
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
      }),
      exposureIntentRepository: exposureIntentRepositoryStub(),
    });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.exposureIntent, null);
    assert.deepEqual(decisions[0]?.exposureCoordinate, {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    });
  });

  it("loads native exposure intent into decisions", async () => {
    const engine = createIntegrationPolicyEngine({
      policyRepository: policyRepositoryStub({
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
      }),
      exposureIntentRepository: exposureIntentRepositoryStub({
        async listForConnectionScope() {
          return [];
        },
        async findForContext(input) {
          assert.deepEqual(input, {
            tenantId: "tenant-a",
            profileId: "denali.telegram.TourCreated",
            surface: "telegram",
            audience: "external_channel",
            trigger: "TourCreated",
            scope: {
              connectionId: "conn-1",
              eventType: "TourCreated",
            },
          });
          return NATIVE_INTENT;
        },
      }),
    });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.exposureIntent?.sourceId, "native-1");
    assert.deepEqual(decisions[0]?.exposureCoordinate, {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    });
  });

  it("uses route-scoped stored intent coordinates as the runtime exposure coordinate", async () => {
    const customIntent = {
      ...NATIVE_INTENT,
      profileId: "denali.telegram.TourPublished",
      trigger: "TourPublished",
      scope: {
        connectionId: "conn-1",
        eventType: "TourCreated",
      },
    };
    const engine = createIntegrationPolicyEngine({
      policyRepository: policyRepositoryStub({
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
      }),
      exposureIntentRepository: exposureIntentRepositoryStub({
        async listForConnectionScope() {
          return [customIntent];
        },
      }),
    });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });

    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.exposureIntent?.profileId, "denali.telegram.TourPublished");
    assert.deepEqual(decisions[0]?.exposureCoordinate, {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourPublished",
    });
  });

  it("allows synthetic legacy telegram without policy rows", async () => {
    const engine = createIntegrationPolicyEngine({
      policyRepository: policyRepositoryStub({
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
              syntheticLegacyConnection: true,
            },
          ];
        },
      }),
      exposureIntentRepository: exposureIntentRepositoryStub(),
    });
    const decisions = await engine.evaluate({
      tenantId: "tenant-a",
      eventType: "TourCreated",
      workspaceType: "denali",
    });
    assert.equal(decisions.length, 1);
    assert.equal(decisions[0]?.exposureIntent, null);
    assert.deepEqual(decisions[0]?.exposureCoordinate, {
      surface: "telegram",
      audience: "external_channel",
      trigger: "TourCreated",
    });
  });

  it("resolves the current profile/intent exposure coordinate without normalizing trigger", () => {
    assert.deepEqual(
      resolveIntegrationPolicyExposureCoordinate({
        provider: "telegram",
        eventType: "BookingConfirmed",
      }),
      {
        surface: "telegram",
        audience: "external_channel",
        trigger: "BookingConfirmed",
      },
    );
  });
});
