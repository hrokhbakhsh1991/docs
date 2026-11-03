import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { it } from "node:test";
import { NextRequest } from "next/server";
import { validateSessionTokenAsync } from "@app-tour/session-client";
import { middleware } from "../middleware";

for (const pathname of ["/api/public-auth/session", "/login"]) {
  it(`a valid ${pathname} read cannot reissue a cookie after concurrent logout`, async () => {
    const names = ["AUTH_JWT_PUBLIC_KEY", "AUTH_JWT_ISSUER", "AUTH_JWT_AUDIENCE"] as const;
    const prior = names.map((name) => process.env[name]);
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    try {
      process.env.AUTH_JWT_PUBLIC_KEY = keys.publicKey
        .export({ type: "spki", format: "pem" })
        .toString();
      process.env.AUTH_JWT_ISSUER = "session-sync-test";
      process.env.AUTH_JWT_AUDIENCE = "session-sync-test";
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
        "base64url"
      );
      const payload = Buffer.from(
        JSON.stringify({
          sub: "session-sync-test-user",
          tenant_id: "00000000-0000-4000-8000-000000000003",
          role: "member",
          iss: "session-sync-test",
          aud: "session-sync-test",
          exp: Math.floor(Date.now() / 1000) + 60,
        })
      ).toString("base64url");
      const unsigned = `${header}.${payload}`;
      const token = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
      assert.equal((await validateSessionTokenAsync(token)).status, "valid");
      const response = await middleware(
        new NextRequest(`http://portal.denali.club:3003${pathname}`, {
          headers: { host: "portal.denali.club:3003", cookie: `atour_mb_session=${token}` },
        })
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.has("set-cookie"),
        false,
        "a late read response must not restore the old session cookie"
      );
      assert.equal(response.headers.has("x-middleware-set-cookie"), false);
    } finally {
      names.forEach((name, index) => {
        if (prior[index] === undefined) delete process.env[name];
        else process.env[name] = prior[index];
      });
    }
  });
}
