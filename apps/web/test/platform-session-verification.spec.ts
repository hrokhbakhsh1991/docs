import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import { proxyPlatformApi } from "../src/platform/proxy-platform-api.server";
import { validatePlatformSessionToken } from "../src/platform/validate-platform-session-token";

const envSnapshot = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_JWT_PUBLIC_KEY_PREVIOUS: process.env.AUTH_JWT_PUBLIC_KEY_PREVIOUS,
  TOUR_OPS_API_URL: process.env.TOUR_OPS_API_URL,
};

const trustedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const forgedKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });

function base64Url(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signToken(
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"],
  claims: Record<string, unknown>
): string {
  const header = base64Url({ alg: "RS256", typ: "JWT" });
  const payload = base64Url(claims);
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString(
    "base64url"
  );
  return `${header}.${payload}.${signature}`;
}

function platformClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sub: "+15550009999",
    kind: "platform_ops",
    platform_role: "owner",
    iss: "platform-test-issuer",
    aud: "platform-test-audience",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function configureVerifier(): void {
  process.env.AUTH_JWT_PUBLIC_KEY = trustedKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.AUTH_JWT_ISSUER = "platform-test-issuer";
  process.env.AUTH_JWT_AUDIENCE = "platform-test-audience";
  process.env.TOUR_OPS_API_URL = "http://api.test";
  delete process.env.AUTH_JWT_PUBLIC_KEY_PREVIOUS;
}

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("platform session verification", () => {
  it("rejects malformed, expired, forged, wrong-issuer, and wrong-audience tokens", async () => {
    configureVerifier();

    const cases = [
      ["malformed", "not-a-jwt"],
      [
        "expired",
        signToken(trustedKeys.privateKey, platformClaims({ exp: Math.floor(Date.now() / 1000) - 60 })),
      ],
      ["forged", signToken(forgedKeys.privateKey, platformClaims())],
      ["wrong issuer", signToken(trustedKeys.privateKey, platformClaims({ iss: "wrong-issuer" }))],
      ["wrong audience", signToken(trustedKeys.privateKey, platformClaims({ aud: "wrong-audience" }))],
    ] as const;

    for (const [label, token] of cases) {
      const result = await validatePlatformSessionToken(token);
      assert.notEqual(result.status, "valid", label);
    }
  });

  it("accepts a valid signed platform session", async () => {
    configureVerifier();
    const token = signToken(trustedKeys.privateKey, platformClaims());

    assert.deepEqual(await validatePlatformSessionToken(token), {
      status: "valid",
      session: { phone: "+15550009999", role: "owner" },
    });
  });

  it("does not translate a forged browser session into a privileged API request", async () => {
    configureVerifier();
    const forged = signToken(forgedKeys.privateKey, platformClaims());
    const originalFetch = globalThis.fetch;
    let upstreamCalls = 0;
    globalThis.fetch = async () => {
      upstreamCalls += 1;
      return new Response(null, { status: 204 });
    };

    try {
      const response = await proxyPlatformApi(
        {
          headers: { get: (name: string) => (name === "cookie" ? `platform_session=${forged}` : null) },
        } as unknown as Request,
        "/platform/v1/tenants"
      );

      assert.equal(response.status, 401);
      assert.equal(upstreamCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
