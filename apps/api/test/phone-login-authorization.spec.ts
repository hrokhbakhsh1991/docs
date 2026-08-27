/**
 * Phone login authorization gate — unit + repository integration
 * @see docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md §5.2
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  getIdentityRepository,
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import {
  isLoginMobileFormatValid,
  isPhoneAuthorizedForTenantLogin,
  normalizeLoginMobile,
} from "../src/identity/phone-login-authorization";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { buildPendingInviteSeed } from "./fixtures/pending-invite-fixture";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("phone-login-authorization.spec.ts", () => {
  beforeEach(() => {
    seedOperatorIdentityFixture();
  });

  it("AUTHZ-01 normalizeLoginMobile trims whitespace", () => {
    assert.equal(normalizeLoginMobile("  +15550001001  "), "+15550001001");
  });

  it("AUTHZ-01b normalizeLoginMobile canonicalizes Iranian local 09… to 09…", () => {
    assert.equal(normalizeLoginMobile("09121000001"), "09121000001");
    assert.equal(normalizeLoginMobile("989121000001"), "09121000001");
  });

  it("AUTHZ-02 isLoginMobileFormatValid rejects empty and short numbers", () => {
    assert.equal(isLoginMobileFormatValid(""), false);
    assert.equal(isLoginMobileFormatValid("123"), false);
    assert.equal(isLoginMobileFormatValid("+15550001001"), true);
  });

  it("AUTHZ-03 active membership authorizes owner mobile", async () => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    const authorized = await isPhoneAuthorizedForTenantLogin(
      OPERATOR_SMOKE.tenantId,
      OPERATOR_SMOKE.ownerMobile,
      repo
    );
    assert.equal(authorized, true);
  });

  it("AUTHZ-04 unknown mobile without invite is not authorized", async () => {
    const repo = resetIdentityRepositoryForTests();
    seedOperatorIdentityFixture();
    const authorized = await isPhoneAuthorizedForTenantLogin(
      OPERATOR_SMOKE.tenantId,
      "+15559999999",
      repo
    );
    assert.equal(authorized, false);
  });

  it("AUTHZ-05 pending invite authorizes invitee mobile", async () => {
    const repo = resetIdentityRepositoryForTests();
    seedOperatorIdentityFixture();
    repo.seedPendingInvite(
      buildPendingInviteSeed({
        inviteId: "00000000-0000-4000-8000-000000000601",
        inviteToken: "00000000-0000-4000-8000-000000000602",
        tenantId: OPERATOR_SMOKE.tenantId,
        phone: OPERATOR_SMOKE.inviteMobile,
        role: "member",
        invitedByUserId: OPERATOR_SMOKE.ownerUserId,
      })
    );
    const authorized = await isPhoneAuthorizedForTenantLogin(
      OPERATOR_SMOKE.tenantId,
      OPERATOR_SMOKE.inviteMobile,
      repo
    );
    assert.equal(authorized, true);
  });

  it("AUTHZ-06 suspended membership is not authorized for login (R1)", async () => {
    const suspendedMobile = "+15550001003";
    const repo = resetIdentityRepositoryForTests();
    seedOperatorIdentityFixture();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: suspendedMobile });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "SUSPENDED",
      sessionVersion: 2,
      workspaceId: "ws-operator-suspended-login",
    });
    const authorized = await isPhoneAuthorizedForTenantLogin(
      OPERATOR_SMOKE.tenantId,
      suspendedMobile,
      repo
    );
    assert.equal(authorized, false);
  });
});
