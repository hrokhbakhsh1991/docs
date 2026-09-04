/**
 * MEG-001 — engagement definitions repository helpers.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EngagementBadgeDefinitionRow } from "../engagement-definition.types";
import {
  findBadgeDefinitionFromRows,
  parseI18nJson,
} from "./prisma-engagement-definitions.repository";

function badgeRow(code: string, status: "active" | "inactive" | "archived"): EngagementBadgeDefinitionRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    workspaceId: "denali",
    code,
    titleI18n: { en: "title", fa: "title" },
    descriptionI18n: { en: "desc", fa: "desc" },
    iconKey: "mountain",
    status,
    triggerKind: "event",
    triggerEventType: "profile.completed",
    triggerMinPoints: null,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
}

describe("prisma-engagement-definitions.repository helpers", () => {
  it("parseI18nJson accepts trimmed fa/en strings", () => {
    assert.deepEqual(parseI18nJson({ fa: " fa ", en: " en " }), { fa: "fa", en: "en" });
  });

  it("parseI18nJson rejects empty or missing locales", () => {
    assert.throws(() => parseI18nJson({ fa: "", en: "ok" }), /ENGAGEMENT_I18N_INVALID/);
    assert.throws(() => parseI18nJson({ fa: "ok" }), /ENGAGEMENT_I18N_INVALID/);
    assert.throws(() => parseI18nJson(null), /ENGAGEMENT_I18N_INVALID/);
  });

  it("findBadgeDefinitionFromRows returns active badge by code", () => {
    const rows = [badgeRow("trailhead_ready", "active"), badgeRow("archived_badge", "archived")];
    assert.equal(findBadgeDefinitionFromRows("trailhead_ready", rows)?.code, "trailhead_ready");
    assert.equal(findBadgeDefinitionFromRows("archived_badge", rows), undefined);
  });
});
