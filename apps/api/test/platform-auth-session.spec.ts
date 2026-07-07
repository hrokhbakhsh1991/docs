import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";

import {
  resetPlatformOpsSessionTokenKeyCacheForTests,
  signPlatformOpsSessionToken,
} from "../src/platform/sign-platform-ops-session-token.ts";
import { resolvePlatformOpsPhoneAccess } from "../src/platform/resolve-platform-ops-phone-access.ts";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  PLATFORM_OPS_PHONES: process.env.PLATFORM_OPS_PHONES,
};

describe("platform-auth-session.spec.ts", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    delete process.env.PLATFORM_OPS_PHONES;
    resetPlatformOpsSessionTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    if (ENV_SNAPSHOT.PLATFORM_OPS_PHONES === undefined) {
      delete process.env.PLATFORM_OPS_PHONES;
    } else {
      process.env.PLATFORM_OPS_PHONES = ENV_SNAPSHOT.PLATFORM_OPS_PHONES;
    }
    resetPlatformOpsSessionTokenKeyCacheForTests();
  });

  it("signPlatformOpsSessionToken includes kind and platform_role", async () => {
    const token = await signPlatformOpsSessionToken({
      phone: "+989121234567",
      role: "admin",
    });
    assert.match(token, /^eyJ/);

    const publicKey = process.env.AUTH_JWT_PUBLIC_KEY;
    assert.ok(publicKey);
    const key = await importSPKI(publicKey, "RS256");
    const verified = await jwtVerify(token, key, {
      issuer: "tour-ops",
      audience: "tour-ops-api",
    });
    assert.equal(verified.payload.kind, "platform_ops");
    assert.equal(verified.payload.platform_role, "admin");
    assert.equal(verified.payload.sub, "+989121234567");
  });

  it("resolvePlatformOpsPhoneAccess returns DB role", async () => {
    const access = await resolvePlatformOpsPhoneAccess("+15550001111", {
      repository: {
        async findByPhone(phone: string) {
          if (phone === "+15550001111") {
            return { phone, role: "support", createdAt: new Date() };
          }
          return null;
        },
        async listAll() {
          return [];
        },
        async upsert() {
          throw new Error("not used");
        },
      },
    });
    assert.deepEqual(access, { role: "support" });
  });
});
