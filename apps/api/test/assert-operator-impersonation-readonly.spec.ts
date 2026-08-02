import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { assertOperatorImpersonationReadonly } from "../src/identity/assert-operator-impersonation-readonly.ts";
import { ImpersonationReadOnlyError } from "../src/identity/impersonation-read-only.error.ts";
import {
  resetPlatformImpersonationSessionTokenKeyCacheForTests,
  signPlatformImpersonationSessionToken,
} from "../src/platform/sign-platform-impersonation-session-token.ts";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
};

describe("assertOperatorImpersonationReadonly", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
  });

  it("PATCH with readonly JWT throws ImpersonationReadOnlyError", async () => {
    const token = await signPlatformImpersonationSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000014",
      sessionVersion: 1,
      platformImpersonator: "+989121234567",
    });

    await assert.rejects(
      () =>
        assertOperatorImpersonationReadonly({
          method: "PATCH",
          headers: { authorization: `Bearer ${token}` },
        } as never),
      ImpersonationReadOnlyError
    );
  });

  it("GET with readonly JWT resolves", async () => {
    const token = await signPlatformImpersonationSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000014",
      sessionVersion: 1,
      platformImpersonator: "+989121234567",
    });

    await assert.doesNotReject(() =>
      assertOperatorImpersonationReadonly({
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      } as never)
    );
  });

  it("PATCH with unsigned dev bearer does not throw Invalid Compact JWS", async () => {
    await assert.doesNotReject(() =>
      assertOperatorImpersonationReadonly({
        method: "PATCH",
        headers: {
          authorization:
            "Bearer dev.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDA0MDEiLCJ0ZW5hbnRJZCI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwNCIsInJvbGUiOiJvd25lciIsInN0YXR1cyI6IkFDVElWRSIsIndvcmtzcGFjZUlkIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwNDAzIiwiZXhwIjo5OTk5OTk5OTk5fQ",
        },
      } as never)
    );
  });
});
