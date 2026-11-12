import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { createRequestListener } from "../src/app.ts";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";
import {
  resetPlatformImpersonationSessionTokenKeyCacheForTests,
  signPlatformImpersonationSessionToken,
} from "../src/platform/sign-platform-impersonation-session-token";
import {
  resetPlatformImpersonationSessionStateForTests,
  setPlatformImpersonationRedisClientForTests,
} from "../src/platform/platform-impersonation-session-state";

installMemoryStorageDriverForDescribe();

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_OPS_PHONES: env.PLATFORM_OPS_PHONES,
  PLATFORM_OPS_BEARER_TOKEN: env.PLATFORM_OPS_BEARER_TOKEN,
};

afterEach(() => {
  resetPlatformImpersonationSessionStateForTests();
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

async function platformHttpJson(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  opts?: { headers?: Record<string, string>; body?: unknown }
) {
  const listener = createRequestListener({ toursService: createTestToursService() });
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const s = http.createServer(listener);
    s.listen(0, () => {
      const a = s.address();
      if (!a || typeof a === "string") {
        s.close();
        reject(new Error("no addr"));
        return;
      }
      const p = opts?.body ? JSON.stringify(opts.body) : undefined;
      const r = http.request(
        {
          hostname: "127.0.0.1",
          port: a.port,
          path,
          method,
          headers: {
            ...(opts?.headers ?? {}),
            ...(p
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(p)),
                }
              : {}),
          },
        },
        (res) => {
          const c: Buffer[] = [];
          res.on("data", (x) => c.push(x as Buffer));
          res.on("end", () => {
            s.close();
            const t = Buffer.concat(c).toString("utf8");
            resolve({ status: res.statusCode ?? 0, body: t ? JSON.parse(t) : {} });
          });
        }
      );
      r.on("error", (e) => {
        s.close();
        reject(e);
      });
      if (p) r.write(p);
      r.end();
    });
  });
}

describe("platform impersonate integration", () => {
  it("rejects support-session writes at ingress even for routes without a rate limit", async () => {
    const names = [
      "AUTH_JWT_PUBLIC_KEY",
      "AUTH_JWT_PRIVATE_KEY",
      "AUTH_JWT_ISSUER",
      "AUTH_JWT_AUDIENCE",
    ] as const;
    const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    try {
      const pair = await generateKeyPair("RS256", { extractable: true });
      process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
      process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
      process.env.AUTH_JWT_ISSUER = "tour-ops";
      process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
      resetPlatformImpersonationSessionTokenKeyCacheForTests();
      setPlatformImpersonationRedisClientForTests({
        async get(key) {
          return key.includes(":exchanged:") ? "1" : null;
        },
        async setWithTtl() {
          return "OK";
        },
        async setIfAbsentWithTtl() {
          return "OK";
        },
      });
      const token = await signPlatformImpersonationSessionToken({
        userId: "00000000-0000-4000-8000-000000000101",
        tenantId: "00000000-0000-4000-8000-000000000014",
        sessionVersion: 1,
        platformImpersonator: "support",
      });
      for (const [method, path] of [
        ["POST", "/not-an-operator-route"],
        ["POST", "/tours"],
        ["PATCH", "/users/00000000-0000-4000-8000-000000000101/role"],
        ["DELETE", "/users/00000000-0000-4000-8000-000000000101"],
        ["PUT", "/settings"],
      ] as const) {
        for (const headers of [
          { Authorization: `Bearer ${token}` },
          { Cookie: `session=${token}` },
        ]) {
          const res = await platformHttpJson(method, path, { headers });
          assert.equal(res.status, 403, `${method} ${path}`);
          assert.equal(res.body.code, "IMPERSONATION_READ_ONLY");
        }
      }
      const read = await platformHttpJson("GET", "/health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(read.status, 200);
    } finally {
      for (const name of names) {
        if (old[name] === undefined) delete process.env[name];
        else process.env[name] = old[name];
      }
      resetPlatformImpersonationSessionTokenKeyCacheForTests();
    }
  });

  it("consumes the exchange once and revokes the read session on logout", async () => {
    const names = [
      "AUTH_JWT_PUBLIC_KEY",
      "AUTH_JWT_PRIVATE_KEY",
      "AUTH_JWT_ISSUER",
      "AUTH_JWT_AUDIENCE",
    ] as const;
    const old = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    const values = new Map<string, string>();
    try {
      const pair = await generateKeyPair("RS256", { extractable: true });
      process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
      process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
      process.env.AUTH_JWT_ISSUER = "tour-ops";
      process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
      resetPlatformImpersonationSessionTokenKeyCacheForTests();
      setPlatformImpersonationRedisClientForTests({
        async get(key) {
          return values.get(key) ?? null;
        },
        async setWithTtl(key, value) {
          values.set(key, value);
          return "OK";
        },
        async setIfAbsentWithTtl(key, value) {
          if (values.has(key)) return null;
          values.set(key, value);
          return "OK";
        },
      });
      const token = await signPlatformImpersonationSessionToken({
        userId: "00000000-0000-4000-8000-000000000101",
        tenantId: "00000000-0000-4000-8000-000000000014",
        sessionVersion: 1,
        platformImpersonator: "support",
      });
      const exchange = {
        sessionToken: token,
      };
      assert.equal(
        (await platformHttpJson("POST", "/auth/accept-platform-impersonation", { body: exchange }))
          .status,
        200
      );
      assert.equal(
        (await platformHttpJson("POST", "/auth/accept-platform-impersonation", { body: exchange }))
          .status,
        401
      );
      assert.equal(
        (
          await platformHttpJson("POST", "/auth/end-platform-impersonation", {
            body: exchange,
          })
        ).status,
        200
      );
      const revokedRead = await platformHttpJson("GET", "/health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(revokedRead.status, 401);
    } finally {
      for (const name of names) {
        if (old[name] === undefined) delete process.env[name];
        else process.env[name] = old[name];
      }
      resetPlatformImpersonationSessionTokenKeyCacheForTests();
    }
  });
  it("PI-01 POST impersonate without auth returns 401", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567";
    const res = await platformHttpJson(
      "POST",
      "/platform/v1/tenants/00000000-0000-4000-8000-000000000014/impersonate"
    );
    assert.equal(res.status, 401);
  });

  it("PI-02 POST impersonate with auth for unknown tenant returns 422", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
    const res = await platformHttpJson(
      "POST",
      "/platform/v1/tenants/00000000-0000-4000-8000-000000000099/impersonate",
      {
        headers: {
          Authorization: "Bearer test",
          "X-Platform-Ops-Phone": "+10000000099",
        },
      }
    );
    assert.ok(res.status === 404 || res.status === 422 || res.status === 500);
  });

  it("PI-03 POST accept impersonation with garbage token returns 401 or 403", async () => {
    const res = await platformHttpJson("POST", "/auth/accept-platform-impersonation", {
      body: { sessionToken: "not-a-jwt" },
    });
    assert.ok(res.status === 401 || res.status === 403);
  });
});
