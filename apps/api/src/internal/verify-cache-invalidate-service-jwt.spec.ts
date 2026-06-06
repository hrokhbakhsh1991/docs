import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";

import {
  assertCacheInvalidateServiceJwt,
  CACHE_INVALIDATE_OPS_SCOPE,
  UNAUTHORIZED_CACHE_INVALIDATE_SERVICE_JWT,
} from "./verify-cache-invalidate-service-jwt";

const envSnapshot = { ...process.env };

let publicKeyPem = "";
let privateKey: CryptoKey;

before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicKeyPem = await exportSPKI(pair.publicKey);
});

afterEach(() => {
  process.env = { ...envSnapshot };
});

async function signServiceJwt(opsScope: string | string[]): Promise<string> {
  return new SignJWT({ ops_scope: opsScope })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("svc-rollback")
    .setIssuer("tour-ops")
    .setAudience("tour-ops-api")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

describe("assertCacheInvalidateServiceJwt (DEC-120)", () => {
  it("skips verify outside production", async () => {
    process.env.NODE_ENV = "test";
    await assertCacheInvalidateServiceJwt(undefined);
  });

  it("accepts valid production service JWT", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await signServiceJwt(CACHE_INVALIDATE_OPS_SCOPE);
    await assertCacheInvalidateServiceJwt(`Bearer ${token}`);
  });

  it("rejects missing ops_scope in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("svc-rollback")
      .setIssuer("tour-ops")
      .setAudience("tour-ops-api")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    await assert.rejects(
      async () => assertCacheInvalidateServiceJwt(`Bearer ${token}`),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_CACHE_INVALIDATE_SERVICE_JWT);
        return true;
      }
    );
  });
});
