/**
 * DEC-106 + DEC-120 — internal cache invalidate (dev/test + prod service JWT).
 */
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { createTestToursService } from "../test-helpers";

describe("4-integration — internal cache invalidate (DEC-106)", () => {
  let server: http.Server;
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    server = http.createServer(createRequestListener({ toursService: createTestToursService() }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    process.env.NODE_ENV = envSnapshot.NODE_ENV;
    process.env.AUTH_JWT_PUBLIC_KEY = envSnapshot.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_ISSUER = envSnapshot.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = envSnapshot.AUTH_JWT_AUDIENCE;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("POST /internal/cache/invalidate returns 200 in test", async () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no address");
    }
    const body = JSON.stringify({ tenantId: "tenant-a", flushRateLimit: false });
    const res = await fetch(`http://127.0.0.1:${addr.port}/internal/cache/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; registryInvalidated: boolean };
    assert.equal(json.ok, true);
    assert.equal(json.registryInvalidated, true);
  });

  it("POST /internal/cache/invalidate returns 401 in production without service JWT", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY =
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy\n7Kz+Y16d3n+8v6Y5l0V0Q8m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0\n0QIDAQAB\n-----END PUBLIC KEY-----";
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";

    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no address");
    }
    const res = await fetch(`http://127.0.0.1:${addr.port}/internal/cache/invalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant-a" }),
    });
    assert.equal(res.status, 401);
  });

  it("POST /internal/cache/invalidate returns 200 in production with service JWT", async () => {
    const pair = await generateKeyPair("RS256");
    const publicKeyPem = await exportSPKI(pair.publicKey);
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY = publicKeyPem;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";

    const token = await new SignJWT({ ops_scope: "cache:invalidate" })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("svc-rollback")
      .setIssuer("tour-ops")
      .setAudience("tour-ops-api")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(pair.privateKey);

    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("no address");
    }
    const res = await fetch(`http://127.0.0.1:${addr.port}/internal/cache/invalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tenantId: "tenant-a", freezeFeatureFlags: true }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      featureFlagFreezeUntil: string | null;
    };
    assert.equal(json.ok, true);
    assert.notEqual(json.featureFlagFreezeUntil, null);
  });
});
