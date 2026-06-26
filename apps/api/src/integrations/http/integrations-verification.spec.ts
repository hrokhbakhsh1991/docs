import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IntegrationConnectionPublicDto } from "../platform/integration-connection.types";
import {
  annotateActiveDeliverySource,
  computeWorkspaceIntegrationsSummary,
  resolveActiveDeliverySource,
  testConnectionMessageForCode,
} from "./integrations-verification";
import {
  buildLegacyTelegramSyntheticId,
  isLegacyTelegramConnectionId,
  parseLegacyTelegramBotId,
} from "../infrastructure/resolve-legacy-telegram-connection";

function sampleIntegration(
  overrides: Partial<IntegrationConnectionPublicDto> = {}
): IntegrationConnectionPublicDto {
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
    secretRefMasked: "integration-connection:conn-1…",
    eventPolicies: [{ eventType: "TourCreated", enabled: true }],
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
    isActiveDeliverySource: false,
    fallbackSuppressed: false,
    ...overrides,
  };
}

describe("integrations verification helpers", () => {
  it("parses legacy synthetic telegram ids", () => {
    const botId = "01234567-89ab-cdef-0123-456789abcdef";
    const synthetic = buildLegacyTelegramSyntheticId(botId);
    assert.equal(isLegacyTelegramConnectionId(synthetic), true);
    assert.equal(parseLegacyTelegramBotId(synthetic), botId);
    assert.equal(parseLegacyTelegramBotId("conn-1"), null);
  });

  it("prefers integration_connection for active delivery source", () => {
    const items = [
      sampleIntegration({ id: "conn-1", enabled: true, status: "enabled" }),
      sampleIntegration({
        id: "legacy-telegram:bot-1",
        backingSource: "legacy_workspace_telegram_bot",
        legacySourceId: "bot-1",
        enabled: true,
      }),
    ];
    assert.equal(resolveActiveDeliverySource(items), "integration_connection");
    const annotated = annotateActiveDeliverySource(items);
    assert.equal(annotated[0]?.isActiveDeliverySource, true);
    assert.equal(annotated[1]?.isActiveDeliverySource, false);
  });

  it("uses legacy delivery source when no enabled integration_connection exists", () => {
    const items = [
      sampleIntegration({ enabled: false, status: "disabled" }),
      sampleIntegration({
        id: "legacy-telegram:bot-1",
        backingSource: "legacy_workspace_telegram_bot",
        legacySourceId: "bot-1",
        enabled: true,
        fallbackSuppressed: false,
      }),
    ];
    assert.equal(resolveActiveDeliverySource(items), "legacy_workspace_telegram_bot");
  });

  it("suppresses legacy fallback when integration_connection row exists", () => {
    const items = [
      sampleIntegration({ enabled: false, status: "disabled" }),
      sampleIntegration({
        id: "legacy-telegram:bot-1",
        backingSource: "legacy_workspace_telegram_bot",
        legacySourceId: "bot-1",
        enabled: true,
        fallbackSuppressed: true,
      }),
    ];
    assert.equal(resolveActiveDeliverySource(items), null);
    const summary = computeWorkspaceIntegrationsSummary(items);
    assert.equal(summary.integrationConnectionCount, 1);
    assert.equal(summary.legacyConnectionCount, 1);
    assert.equal(summary.activeDeliverySource, null);
  });

  it("maps test connection codes to operator-facing messages", () => {
    assert.match(testConnectionMessageForCode("INTEGRATION_CONFIG_INCOMPLETE"), /Channel ID/);
  });
});
