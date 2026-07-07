import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLegacyTelegramFallbackEnabled } from "./legacy-telegram-fallback-env";
import {
  buildMigratedLegacySecretRef,
  isMigratedLegacySecretRef,
} from "./migrated-legacy-secret-ref";
import {
  buildTelegramBackfillPlanItem,
  detectTelegramBackfillMismatches,
  mapLegacyEnabledToStatus,
} from "./telegram-backfill-plan";

describe("legacy telegram fallback env", () => {
  it("defaults to enabled when unset", () => {
    const previous = process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED;
    delete process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED;
    assert.equal(isLegacyTelegramFallbackEnabled(), true);
    if (previous !== undefined) {
      process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED = previous;
    }
  });

  it("honors false to disable fallback", () => {
    const previous = process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED;
    process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED = "false";
    assert.equal(isLegacyTelegramFallbackEnabled(), false);
    if (previous !== undefined) {
      process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED = previous;
    } else {
      delete process.env.LEGACY_TELEGRAM_FALLBACK_ENABLED;
    }
  });
});

describe("telegram backfill plan", () => {
  const legacy = {
    id: "bot-1",
    tenantId: "tenant-a",
    workspaceType: "denali",
    channelId: "@channel",
    enabled: true,
    botToken: "token",
    createdByUserId: null,
  };

  it("maps enabled legacy to enabled status", () => {
    assert.equal(mapLegacyEnabledToStatus(true), "enabled");
    assert.equal(mapLegacyEnabledToStatus(false), "disabled");
  });

  it("skips when integration_connection already exists", () => {
    const plan = buildTelegramBackfillPlanItem({
      legacy,
      existingConnection: { id: "conn-existing" },
      connectionId: "conn-new",
      migratedAtIso: "2026-06-26T00:00:00.000Z",
    });
    assert.equal(plan.action, "skip_existing");
  });

  it("plans insert with secret store strategy when bot token exists", () => {
    const plan = buildTelegramBackfillPlanItem({
      legacy,
      existingConnection: null,
      connectionId: "conn-new",
      migratedAtIso: "2026-06-26T00:00:00.000Z",
    });
    assert.equal(plan.action, "insert");
    assert.equal(plan.proposed?.secretStrategy, "integration_secret_store");
    assert.ok(plan.proposed?.secretRef?.startsWith("integration-connection:"));
    assert.equal(plan.proposed?.config.channelId, "@channel");
    assert.equal(plan.proposed?.config.migratedFromLegacyBotId, "bot-1");
  });

  it("plans migrated legacy marker when bot token is empty", () => {
    const plan = buildTelegramBackfillPlanItem({
      legacy: { ...legacy, botToken: "" },
      existingConnection: null,
      connectionId: "conn-new",
      migratedAtIso: "2026-06-26T00:00:00.000Z",
    });
    assert.equal(plan.proposed?.secretStrategy, "migrated_legacy_marker");
    assert.equal(plan.proposed?.secretRef, buildMigratedLegacySecretRef("bot-1"));
    assert.ok(isMigratedLegacySecretRef(plan.proposed?.secretRef));
  });
});

describe("telegram backfill verification", () => {
  const legacy = {
    id: "bot-1",
    tenantId: "tenant-a",
    workspaceType: "denali",
    channelId: "@channel",
    enabled: true,
    botToken: "token",
    createdByUserId: null,
  };

  it("detects legacy without connection", () => {
    const mismatches = detectTelegramBackfillMismatches({
      legacy,
      connections: [],
    });
    assert.equal(
      mismatches.some((entry) => entry.kind === "legacy_without_connection"),
      true
    );
  });

  it("detects channel and secret mismatches", () => {
    const mismatches = detectTelegramBackfillMismatches({
      legacy,
      connections: [
        {
          id: "conn-1",
          tenantId: "tenant-a",
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: false,
          config: { channelId: "@other" },
          secretRef: null,
          hasSecretPayload: false,
        },
      ],
    });
    assert.ok(mismatches.some((entry) => entry.kind === "channel_id_mismatch"));
    assert.ok(mismatches.some((entry) => entry.kind === "enabled_mismatch"));
    assert.ok(mismatches.some((entry) => entry.kind === "secret_missing_for_token"));
  });
});
