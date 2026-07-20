import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

import { exportSPKI, generateKeyPair, SignJWT } from "jose";

import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "./auth-errors";
import { tryResolveJwtBearerAsync } from "./parse-jwt-bearer";

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

async function signTestJwt(claims: Record<string, string>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.sub ?? "user-jwt")
    .setIssuer("tour-ops")
    .setAudience("tour-ops-api")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

describe("tryResolveJwtBearerAsync", () => {
  it("returns null when JWT verify is not configured", async () => {
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    const token = await signTestJwt({
      sub: "user-1",
      tenant_id: "tenant-jwt",
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-jwt",
    });
    const ctx = await tryResolveJwtBearerAsync(`Bearer ${token}`);
    assert.equal(ctx, null);
  });

  it("resolves tenant context from RS256 JWT when configured", async () => {
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await signTestJwt({
      sub: "user-jwt",
      tenant_id: "tenant-jwt",
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-jwt",
    });
    const resolved = await tryResolveJwtBearerAsync(`Bearer ${token}`);
    assert.equal(resolved?.context.tenantId, "tenant-jwt");
    assert.equal(resolved?.context.workspaceId, "ws-jwt");
    assert.equal(resolved?.sessionVersion, undefined);
  });

  it("MR-P0-006: parses sess_ver claim from JWT", async () => {
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await signTestJwt({
      sub: "user-jwt",
      tenant_id: "tenant-jwt",
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-jwt",
      sess_ver: "3",
    });
    const resolved = await tryResolveJwtBearerAsync(`Bearer ${token}`);
    assert.equal(resolved?.sessionVersion, 3);
  });

  it("rejects conflicting tenant_id and tenantId aliases", async () => {
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    const token = await signTestJwt({
      sub: "user-jwt",
      tenant_id: "tenant-a",
      tenantId: "tenant-b",
      role: "admin",
      membership_status: "ACTIVE",
      workspace_id: "ws-jwt",
    });
    await assert.rejects(
      () => tryResolveJwtBearerAsync(`Bearer ${token}`),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, UNAUTHORIZED_INVALID_BEARER_TOKEN);
        return true;
      }
    );
  });
});
