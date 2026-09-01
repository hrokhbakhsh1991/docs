import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import { validateSessionTokenAsync } from "../src/index.js";

const require = createRequire(import.meta.url);
const { SignJWT, exportSPKI, generateKeyPair } = require("../../../apps/api/node_modules/jose");

describe("DG-4.7.2 JWT parity drift", () => {
  const ENV_SNAPSHOT = {
    AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  };

  const restoreEnv = (): void => {
    for (const [key, value] of Object.entries(ENV_SNAPSHOT)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  it("REG-JWT-01 mismatched verify key yields invalid_signature (Marketing auth / Portal /login class)", async () => {
    const apiPair = await generateKeyPair("RS256", { extractable: true });
    const stalePair = await generateKeyPair("RS256", { extractable: true });
    const apiPublic = await exportSPKI(apiPair.publicKey);
    const stalePublic = await exportSPKI(stalePair.publicKey);

    assert.notEqual(
      createHash("sha256").update(apiPublic).digest("hex").slice(0, 16),
      createHash("sha256").update(stalePublic).digest("hex").slice(0, 16)
    );

    process.env.AUTH_JWT_PUBLIC_KEY = apiPublic;
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";

    const token = await new SignJWT({
      tenant_id: "00000000-0000-4000-8000-000000000014",
      role: "member",
      sess_ver: 1,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("user-smoke")
      .setIssuer("tour-ops")
      .setAudience("tour-ops-api")
      .setExpirationTime("2h")
      .sign(apiPair.privateKey);

    assert.equal((await validateSessionTokenAsync(token)).status, "valid");

    process.env.AUTH_JWT_PUBLIC_KEY = stalePublic;
    assert.equal((await validateSessionTokenAsync(token)).status, "invalid_signature");

    restoreEnv();
  });
});
