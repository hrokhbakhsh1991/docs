/**
 * Phase 9.6 — audit trail read-only web (R-P9-S13)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAuditOccurredAt,
  parseAuditTrailResponse,
} from "../src/features/settings/audit-trail-logic";
import { AUDIT_TRAIL_TEST_IDS } from "../src/features/settings/audit-trail-types";
import {
  hrefForSettingsModule,
  isAuditTrailModuleSupported,
  isSettingsPilotModule,
  labelForSettingsModule,
} from "../src/features/settings/settings-hub-logic";
import { SETTINGS_MODULE_LABEL_KEYS } from "../src/features/settings/settings-module-types";

describe("settings-audit-trail.spec.ts — Phase 9.6 Web", () => {
  it("WEB-9.6-AUD-01 audit trail module is pilot-visible", () => {
    assert.equal(isAuditTrailModuleSupported("audit_trail"), true);
    assert.equal(isAuditTrailModuleSupported("equipment"), false);
    assert.equal(isSettingsPilotModule("audit_trail"), true);
    assert.equal(SETTINGS_MODULE_LABEL_KEYS.audit_trail, "modules.audit_trail.title");
    assert.equal(AUDIT_TRAIL_TEST_IDS.page, "operator-settings-audit-trail-page");
    assert.equal(AUDIT_TRAIL_TEST_IDS.list, "operator-settings-audit-trail-list");

    const module = {
      id: "audit_trail",
      kind: "readonly_explorer" as const,
      route: "settings/audit-trail",
      ability: "operator.settings.audit_trail",
      nav: { group: "finance_ops" as const, labelKey: "settings.audit_trail" },
    };
    assert.equal(labelForSettingsModule(module), SETTINGS_MODULE_LABEL_KEYS.audit_trail);
    assert.equal(hrefForSettingsModule(module), "/settings/audit-trail");
  });

  it("WEB-9.6-AUD-02 parse audit events from BFF payload", () => {
    const parsed = parseAuditTrailResponse({
      items: [
        {
          id: "evt-1",
          tenantId: "tenant-a",
          occurredAt: "2026-06-08T12:00:00.000Z",
          actorUserId: "user-1",
          action: "settings.equipment.create",
          resourceType: "equipment",
          resourceId: "eq-1",
          summary: "Created equipment",
        },
      ],
      total: 1,
    });
    assert.equal(parsed.total, 1);
    assert.equal(parsed.items[0]?.summary, "Created equipment");
    assert.equal(formatAuditOccurredAt("not-a-date", "en"), "not-a-date");
    const faFormatted = formatAuditOccurredAt("2026-06-08T12:00:00.000Z", "fa");
    assert.match(faFormatted, /[۰-۹]/);
    const formatted = formatAuditOccurredAt("2026-06-08T12:00:00.000Z", "en");
    assert.match(formatted, /2026/);
    const formattedFa = formatAuditOccurredAt("2026-06-08T12:00:00.000Z", "fa");
    assert.notEqual(formattedFa, formatted);
  });
});
