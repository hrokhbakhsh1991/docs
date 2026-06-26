/**
 * Denali integrations settings — hub wiring + DTO parsing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  hrefForSettingsModule,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import {
  SETTINGS_HUB_TEST_IDS,
  SETTINGS_MODULE_LABEL_KEYS,
} from "../src/features/settings/settings-module-types";
import { parseWorkspaceIntegrationsListResponse } from "../src/integrations/integrations-types";

const REPO_ROOT = join(import.meta.dirname, "../../..");

describe("settings-integrations.spec.ts — Denali wiring", () => {
  it("WEB-INT-01 denali manifest exposes integrations settings module", () => {
    const manifest = readFileSync(
      join(REPO_ROOT, "packages/workspaces/denali/src/settings/denali-settings.manifest.ts"),
      "utf8"
    );
    assert.match(manifest, /id: "integrations"/);
    assert.match(manifest, /settings\/integrations/);
    assert.match(manifest, /operator\.settings\.integrations/);
  });

  it("WEB-INT-02 settings hub links to integrations page", () => {
    const module = {
      id: "integrations",
      kind: "readonly_explorer" as const,
      route: "settings/integrations",
      ability: "operator.settings.integrations",
      nav: { group: "workspace" as const, labelKey: "settings.integrations" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.integrations);
    assert.equal(hrefForSettingsModule(module), "/settings/integrations");
    assert.equal(SETTINGS_HUB_TEST_IDS.integrationsPage, "operator-settings-integrations-page");
  });

  it("WEB-INT-03 parses list response with legacy + integration rows", () => {
    const parsed = parseWorkspaceIntegrationsListResponse({
      items: [
        {
          id: "conn-1",
          tenantId: "tenant-a",
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { channelId: "@ops" },
          hasSecret: true,
          secretRefMasked: "integrat…n-1",
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
          isActiveDeliverySource: true,
          fallbackSuppressed: false,
        },
        {
          id: "legacy-telegram:bot-1",
          tenantId: "tenant-a",
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { channelId: "@legacy" },
          hasSecret: true,
          secretRefMasked: null,
          eventPolicies: [{ eventType: "TourCreated", enabled: true }],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          backingSource: "legacy_workspace_telegram_bot",
          legacySourceId: "bot-1",
          actionsAllowed: {
            enable: false,
            disable: false,
            test: true,
            patch: false,
            delete: false,
          },
          isActiveDeliverySource: false,
          fallbackSuppressed: true,
        },
      ],
      summary: {
        integrationConnectionCount: 1,
        legacyConnectionCount: 1,
        activeDeliverySource: "integration_connection",
      },
    });

    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0]?.backingSource, "integration_connection");
    assert.equal(parsed.items[1]?.fallbackSuppressed, true);
    assert.equal(parsed.summary.activeDeliverySource, "integration_connection");
  });
});
