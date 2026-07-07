import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIntegrationPatchInput,
  channelIdFromConfig,
  hasActiveTelegramDeliverySource,
  hasPlatformIntegrationConnection,
  hasPlatformTelegramConnection,
  integrationStatusBadgeKey,
  resolveIntegrationFallbackLabel,
  resolveIntegrationsWorkspaceScenario,
  shouldShowIntegrationsScenarioCard,
} from "../src/integrations/integrations-settings-logic";
import {
  parseWorkspaceIntegrationSurfaceMetaResponse,
  type IntegrationConnectionPublic,
} from "../src/integrations/integrations-types";

function sampleItem(
  overrides: Partial<IntegrationConnectionPublic> = {}
): IntegrationConnectionPublic {
  return {
    id: "conn-1",
    tenantId: "tenant-a",
    workspaceType: "denali",
    provider: "telegram",
    status: "enabled",
    enabled: true,
    capabilities: ["message.send"],
    config: { channelId: "@channel" },
    hasSecret: true,
    secretRefMasked: null,
    eventPolicies: [],
    exposureIntents: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    backingSource: "integration_connection",
    legacySourceId: null,
    actionsAllowed: {
      enable: true,
      disable: true,
      test: true,
      patch: true,
      delete: true,
    },
    isActiveDeliverySource: true,
    fallbackSuppressed: false,
    ...overrides,
  };
}

describe("integrations-settings-logic", () => {
  it("WEB-INT-04 resolves workspace scenarios", () => {
    assert.equal(
      resolveIntegrationsWorkspaceScenario({
        items: [],
        summary: {
          integrationConnectionCount: 0,
          legacyConnectionCount: 0,
          activeDeliverySource: null,
        },
      }),
      "empty"
    );
    assert.equal(
      resolveIntegrationsWorkspaceScenario({
        items: [sampleItem({ backingSource: "legacy_workspace_telegram_bot" })],
        summary: {
          integrationConnectionCount: 0,
          legacyConnectionCount: 1,
          activeDeliverySource: "legacy_workspace_telegram_bot",
        },
      }),
      "legacy_only"
    );
    assert.equal(
      resolveIntegrationsWorkspaceScenario({
        items: [
          sampleItem(),
          sampleItem({
            id: "legacy-telegram:bot-1",
            backingSource: "legacy_workspace_telegram_bot",
            fallbackSuppressed: true,
            isActiveDeliverySource: false,
          }),
        ],
        summary: {
          integrationConnectionCount: 1,
          legacyConnectionCount: 1,
          activeDeliverySource: "integration_connection",
        },
      }),
      "migration_ready"
    );
    assert.equal(
      resolveIntegrationsWorkspaceScenario({
        items: [sampleItem()],
        summary: {
          integrationConnectionCount: 1,
          legacyConnectionCount: 0,
          activeDeliverySource: "integration_connection",
        },
      }),
      "active_new_system"
    );
  });

  it("WEB-INT-05 resolves legacy fallback labels", () => {
    assert.equal(
      resolveIntegrationFallbackLabel(
        sampleItem({ backingSource: "legacy_workspace_telegram_bot", fallbackSuppressed: true })
      ),
      "suppressed"
    );
    assert.equal(
      resolveIntegrationFallbackLabel(
        sampleItem({
          backingSource: "legacy_workspace_telegram_bot",
          isActiveDeliverySource: true,
        })
      ),
      "active"
    );
    assert.equal(resolveIntegrationFallbackLabel(sampleItem()), "not_applicable");
  });

  it("WEB-INT-06 maps integration status badge", () => {
    assert.equal(integrationStatusBadgeKey(sampleItem()), "enabled");
    assert.equal(
      integrationStatusBadgeKey(sampleItem({ enabled: false, status: "disabled" })),
      "disabled"
    );
    assert.equal(integrationStatusBadgeKey(sampleItem({ status: "error" })), "error");
  });

  it("WEB-INT-07 detects platform Telegram connections", () => {
    assert.equal(
      hasPlatformTelegramConnection({
        items: [sampleItem({ backingSource: "legacy_workspace_telegram_bot" })],
        summary: {
          integrationConnectionCount: 0,
          legacyConnectionCount: 1,
          activeDeliverySource: "legacy_workspace_telegram_bot",
        },
      }),
      false
    );
    assert.equal(
      hasPlatformTelegramConnection({
        items: [sampleItem()],
        summary: {
          integrationConnectionCount: 1,
          legacyConnectionCount: 0,
          activeDeliverySource: "integration_connection",
        },
      }),
      true
    );
  });

  it("WEB-INT-10 detects provider-specific platform connections", () => {
    assert.equal(
      hasPlatformIntegrationConnection(
        {
          items: [sampleItem({ provider: "slack" })],
          summary: {
            integrationConnectionCount: 1,
            legacyConnectionCount: 0,
            activeDeliverySource: "integration_connection",
          },
        },
        "telegram"
      ),
      false
    );
  });

  it("WEB-INT-08 hides the scenario card for empty state", () => {
    assert.equal(shouldShowIntegrationsScenarioCard("empty"), false);
    assert.equal(shouldShowIntegrationsScenarioCard("legacy_only"), true);
    assert.equal(shouldShowIntegrationsScenarioCard(null), false);
  });

  it("WEB-INT-09 resolves channel id display", () => {
    assert.equal(channelIdFromConfig({ channelId: "@ops" }), "@ops");
    assert.equal(channelIdFromConfig({}), "—");
  });

  it("WEB-INT-11 parses integration surface metadata", () => {
    const parsed = parseWorkspaceIntegrationSurfaceMetaResponse({
      workspaceType: "denali",
      providers: [
        {
          id: "telegram",
          configFields: [{ id: "channelId", kind: "string", requiredOnCreate: true }],
          credentialFields: [{ id: "botToken", kind: "secret", requiredOnCreate: true }],
          defaultCapabilities: ["message.send"],
          defaultEventPolicies: [{ eventType: "TourCreated", enabled: true }],
        },
      ],
      exposureCandidateFields: [{ id: "title", canonicalPath: "title", kind: "text" }],
    });

    assert.equal(parsed.providers[0]?.id, "telegram");
    assert.equal(parsed.providers[0]?.credentialFields[0]?.kind, "secret");
    assert.deepEqual(parsed.providers[0]?.defaultEventPolicies, [
      { eventType: "TourCreated", enabled: true },
    ]);
    assert.deepEqual(parsed.exposureCandidateFields, [
      { id: "title", canonicalPath: "title", kind: "text" },
    ]);
    assert.equal(
      (parsed as Record<string, unknown>).deliveryCandidateFields,
      undefined,
      "Phase 7g: parser must not re-emit the legacy delivery alias",
    );
  });

  it("WEB-INT-11b parses legacy delivery candidate field alias as exposure catalog fallback", () => {
    const parsed = parseWorkspaceIntegrationSurfaceMetaResponse({
      workspaceType: "denali",
      providers: [],
      deliveryCandidateFields: [{ id: "title", canonicalPath: "title", kind: "text" }],
    });

    assert.deepEqual(parsed.exposureCandidateFields, [
      { id: "title", canonicalPath: "title", kind: "text" },
    ]);
  });

  it("WEB-INT-12 builds patch payload for channel and token rotation", () => {
    const provider = {
      id: "telegram",
      configFields: [{ id: "channelId", kind: "string" as const, requiredOnCreate: true }],
      credentialFields: [{ id: "botToken", kind: "secret" as const, requiredOnCreate: true }],
      defaultCapabilities: ["message.send"],
      defaultEventPolicies: [],
    };

    assert.deepEqual(
      buildIntegrationPatchInput(
        provider,
        { channelId: "@ops" },
        { "config.channelId": "@ops", "credentials.botToken": "new-token" }
      ),
      { credentials: { botToken: "new-token" } }
    );

    assert.deepEqual(
      buildIntegrationPatchInput(
        provider,
        { channelId: "@ops" },
        { "config.channelId": "@alerts" }
      ),
      { config: { channelId: "@alerts" } }
    );

    assert.equal(
      buildIntegrationPatchInput(provider, { channelId: "@ops" }, { "config.channelId": "@ops" }),
      null
    );
  });

  it("WEB-INT-13 detects active telegram delivery source", () => {
    const activeIntegration = {
      items: [sampleItem({ provider: "telegram", isActiveDeliverySource: true })],
      summary: {
        integrationConnectionCount: 1,
        legacyConnectionCount: 0,
        activeDeliverySource: "integration_connection" as const,
      },
    };
    assert.equal(hasActiveTelegramDeliverySource(activeIntegration), true);

    const disabled = {
      items: [sampleItem({ provider: "telegram", enabled: false, isActiveDeliverySource: false })],
      summary: {
        integrationConnectionCount: 1,
        legacyConnectionCount: 0,
        activeDeliverySource: null,
      },
    };
    assert.equal(hasActiveTelegramDeliverySource(disabled), false);

    assert.equal(hasActiveTelegramDeliverySource(null), false);
  });
});
