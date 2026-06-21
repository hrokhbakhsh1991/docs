import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTenantActiveForOperatorLogin,
  type TenantLoginStatusResolver,
} from "../src/identity/assert-tenant-active-for-login.ts";
import { TenantSuspendedForLoginError } from "../src/identity/phone-preflight.errors.ts";
import { handleRequestOtp } from "../src/identity/auth.routes.ts";
import { getIdentityRepository } from "../src/identity/create-identity-repository.ts";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant.ts";
import { operatorAuthHeaders, seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture.ts";
import { installMemoryStorageDriverForDescribe } from "./test-helpers.ts";

installMemoryStorageDriverForDescribe();

function makeMockReq(headers: Record<string, string>, body: string) {
  return {
    headers,
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(body);
    },
  } as never;
}

function makeMockRes() {
  let body = "";
  const res = {
    statusCode: 0,
    setHeader: (_name: string, _value: string) => {},
    end: (b: string) => {
      body = b;
    },
    _get: () => ({ status: res.statusCode, body: body ? JSON.parse(body) : {} }),
  };
  return res as never;
}

describe("platform tenant suspend login", () => {
  it("assertTenantActiveForOperatorLogin throws when suspended", async () => {
    const resolveStatus: TenantLoginStatusResolver = async () => "suspended";
    await assert.rejects(
      () => assertTenantActiveForOperatorLogin("tenant-1", { resolveStatus }),
      TenantSuspendedForLoginError
    );
  });

  it("assertTenantActiveForOperatorLogin passes when active", async () => {
    const resolveStatus: TenantLoginStatusResolver = async () => "active";
    await assertTenantActiveForOperatorLogin("tenant-1", { resolveStatus });
  });

  it("request-otp returns AUTH_TENANT_SUSPENDED for suspended tenant", async () => {
    seedOperatorIdentityFixture();
    const resolveStatus: TenantLoginStatusResolver = async () => "suspended";
    const req = makeMockReq(
      {
        ...operatorAuthHeaders(),
        "content-type": "application/json",
      },
      JSON.stringify({ mobile: OPERATOR_SMOKE.ownerMobile })
    );
    const res = makeMockRes();

    await handleRequestOtp(req, res, getIdentityRepository(), {
      resolveTenantStatus: resolveStatus,
    });

    const out = res._get();
    assert.equal(out.status, 403);
    assert.equal(out.body.code, "AUTH_TENANT_SUSPENDED");
  });
});
