/**
 * SK3 BP-7 — portal member plan tables + apply-plan → membership grants.
 */
import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { InMemoryPortalMemberPlanRepository } from "../src/identity/in-memory-portal-member-plan.repository";
import {
  applyPortalMemberPlan,
  PortalMemberPlanNotFoundError,
  setPortalMemberPlanRepositoryForTests,
  upsertPortalMemberPlan,
} from "../src/identity/portal-member-plan.service";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("portal-member-plan-bp7.spec.ts — SK3 BP-7", () => {
  const plans = new InMemoryPortalMemberPlanRepository();
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  let memberUserId = "";
  let memberWorkspaceId = "";

  before(async () => {
    seedOperatorIdentityFixture();
    setPortalMemberPlanRepositoryForTests(plans);
    const idRepo = getIdentityRepository();
    const { user, membership } = await idRepo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: "+15559007701",
      displayName: "BP7 Plan Member",
      email: "bp7-plan-member@denali-smoke.local",
    });
    memberUserId = user.id;
    memberWorkspaceId = membership.workspaceId ?? "ws-bp7";
  });

  afterEach(() => {
    setPortalMemberPlanRepositoryForTests(plans);
  });

  it("BP7-01 upsert + apply writes grants and bumps revision", async () => {
    const plan = await upsertPortalMemberPlan({
      tenantId: OPERATOR_SMOKE.tenantId,
      planCode: "tenant-wallet-access",
      displayName: "Wallet access (tenant-defined)",
      moduleGrants: ["wallet"],
      capabilityFlags: { "member.module.wallet.export": true },
    });
    assert.equal(plan.planCode, "tenant-wallet-access");
    assert.deepEqual([...plan.moduleGrants], ["wallet"]);

    const applied = await applyPortalMemberPlan({
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: memberUserId,
      planCode: "tenant-wallet-access",
    });
    assert.equal(applied.ok, true);
    assert.equal(applied.planCode, "tenant-wallet-access");
    assert.deepEqual([...applied.moduleGrants], ["wallet"]);
    assert.equal(applied.entitlementsRevision, 1);
    assert.equal(applied.capabilityFlags["member.module.wallet.export"], true);

    const again = await applyPortalMemberPlan({
      tenantId: OPERATOR_SMOKE.tenantId,
      userId: memberUserId,
      planCode: "tenant-wallet-access",
    });
    assert.equal(again.entitlementsRevision, 2);
  });

  it("BP7-02 unknown plan code fails closed", async () => {
    await assert.rejects(
      () =>
        applyPortalMemberPlan({
          tenantId: OPERATOR_SMOKE.tenantId,
          userId: memberUserId,
          planCode: "does-not-exist",
        }),
      (error: unknown) => error instanceof PortalMemberPlanNotFoundError
    );
  });

  it("BP7-03 HTTP upsert + apply-plan then me/entitlements exposes plan meta", async () => {
    const upsert = await client.requestJson<{
      ok?: boolean;
      planCode?: string;
      moduleGrants?: string[];
    }>("POST", "/internal/portal-member-entitlements/plans/upsert", {
      body: {
        tenantId: OPERATOR_SMOKE.tenantId,
        planCode: "http-tenant-plan",
        displayName: "HTTP tenant plan",
        moduleGrants: ["wallet"],
        capabilityFlags: { "member.module.wallet.read": true },
      },
    });
    assert.equal(upsert.status, 200);
    assert.equal(upsert.body.ok, true);
    assert.equal(upsert.body.planCode, "http-tenant-plan");

    const apply = await client.requestJson<{
      ok?: boolean;
      entitlementsRevision?: number;
    }>("POST", "/internal/portal-member-entitlements/apply-plan", {
      body: {
        tenantId: OPERATOR_SMOKE.tenantId,
        userId: memberUserId,
        planCode: "http-tenant-plan",
      },
    });
    assert.equal(apply.status, 200);
    assert.equal(apply.body.ok, true);
    assert.ok((apply.body.entitlementsRevision ?? 0) >= 1);

    const entitlements = await client.requestJson<{
      ok?: boolean;
      workspaceId?: string;
      granted?: string[];
      denied?: unknown[];
      planCode?: string;
      entitlementsRevision?: number;
      capabilities?: Record<string, boolean>;
    }>("GET", "/identity/me/entitlements", {
      headers: {
        "x-tenant-id": OPERATOR_SMOKE.tenantId,
        "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
        "x-user-id": memberUserId,
        "x-actor-role": "member",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": memberWorkspaceId,
      },
    });
    assert.equal(entitlements.status, 200);
    assert.equal(entitlements.body.ok, true);
    assert.equal(entitlements.body.workspaceId, memberWorkspaceId);
    assert.equal(entitlements.body.planCode, "http-tenant-plan");
    assert.ok((entitlements.body.entitlementsRevision ?? 0) >= 1);
    assert.equal(entitlements.body.capabilities?.["member.module.wallet.read"], true);
    assert.ok(entitlements.body.granted?.includes("member.module.wallet"));
    assert.deepEqual(
      (entitlements.body.denied ?? []).filter(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "key" in entry &&
          (entry as { key: string }).key === "member.module.wallet"
      ),
      []
    );
  });

  it("BP7-04 does not invent platform SKUs — inactive plan is not applyable", async () => {
    await upsertPortalMemberPlan({
      tenantId: OPERATOR_SMOKE.tenantId,
      planCode: "retired-tenant-code",
      displayName: "Retired",
      moduleGrants: ["wallet"],
      active: false,
    });
    await assert.rejects(
      () =>
        applyPortalMemberPlan({
          tenantId: OPERATOR_SMOKE.tenantId,
          userId: memberUserId,
          planCode: "retired-tenant-code",
        }),
      (error: unknown) => error instanceof PortalMemberPlanNotFoundError
    );
  });
});
