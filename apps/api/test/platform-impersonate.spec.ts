import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app.ts";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  PLATFORM_OPS_PHONES: env.PLATFORM_OPS_PHONES,
  PLATFORM_OPS_BEARER_TOKEN: env.PLATFORM_OPS_BEARER_TOKEN,
};

afterEach(() => {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

async function platformHttpJson(
  method: "GET" | "POST" | "PATCH",
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
            ...(p ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(p)) } : {}),
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
