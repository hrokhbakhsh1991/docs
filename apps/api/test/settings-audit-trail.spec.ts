/**
 * Phase 9.6 — audit trail read-only (R-P9-S13)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetSettingsAuditRepositorySingletonForTests } from "../src/settings/create-settings-audit-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorSettingsAuditFixture } from "./fixtures/operator-settings-audit-fixture";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type AuditResponse = Record<string, unknown>;

function createAuditTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("settings-audit-trail.spec.ts — Phase 9.6 API", () => {
  const client = installHttpTestClient(createAuditTestListener);

  before(async () => {
    seedOperatorIdentityFixture();
    await seedOperatorSettingsAuditFixture();
  });

  it("API-9.6-AUD-01 GET audit events tenant-scoped", async () => {
    const response = await client.requestJson<AuditResponse>("GET", "/settings/explore/audit_trail", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    const items = response.body.items as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(items));
    assert.ok(items.length >= 2);
    assert.equal(items.every((item) => item.tenantId === OPERATOR_SMOKE.tenantId), true);
    assert.equal(typeof items[0]?.summary, "string");
  });

  it("API-9.6-AUD-02 PUT audit endpoint returns 405", async () => {
    const response = await client.requestJson<AuditResponse>("PUT", "/settings/explore/audit_trail", {
      headers: operatorAuthHeaders(),
      body: { summary: "should fail" },
    });
    assert.equal(response.status, 405);
    assert.equal(response.body.code, "SETTINGS_EXPLORE_READ_ONLY");
  });

  it("API-9.6-AUD-03 resource create appends audit event (R-P9-S13)", async () => {
    resetSettingsAuditRepositorySingletonForTests();

    const createRes = await client.requestJson<AuditResponse>("POST", "/settings/resources/equipment", {
      headers: operatorAuthHeaders(),
      body: { name: "Audit Trail Pack", category: "gear" },
    });
    assert.equal(createRes.status, 201);

    const auditRes = await client.requestJson<AuditResponse>("GET", "/settings/explore/audit_trail", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(auditRes.status, 200);
    const items = auditRes.body.items as Array<Record<string, unknown>>;
    assert.ok(items.some((item) => item.action === "settings.equipment.create"));
    assert.ok(items.some((item) => String(item.summary).includes("Audit Trail Pack")));
  });
});
