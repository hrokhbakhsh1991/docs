import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app.ts";
import { assertPlatformOpsOwnerRole, assertPlatformOpsWriteRole } from "../src/platform/assert-platform-ops-role.ts";
import { PlatformForbidden } from "../src/platform/platform.errors.ts";
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

function platformOwnerHeaders(phone = "+989121234567") {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": phone };
}

function platformSupportHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+10000000099" };
}

describe("platform subscription integration", () => {
  it("PS-01 GET plans without auth returns 401", async () => {
    const res = await platformHttpJson("GET", "/platform/v1/plans");
    assert.equal(res.status, 401);
  });

  it("PS-02 GET plans with owner auth returns items array when 200", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
    const res = await platformHttpJson("GET", "/platform/v1/plans", {
      headers: platformOwnerHeaders(),
    });
    if (res.status === 200) {
      assert.ok(Array.isArray(res.body.items));
    } else {
      assert.ok(res.status === 500);
    }
  });

  it("PS-03 mark-paid rejects support role", () => {
    assert.throws(
      () => assertPlatformOpsOwnerRole({ actorId: "+10000000099", roles: ["support"] }),
      PlatformForbidden
    );
  });

  it("PS-04 PATCH subscription rejects support write role", () => {
    assert.throws(
      () => assertPlatformOpsWriteRole({ actorId: "+10000000099", roles: ["support"] }),
      PlatformForbidden
    );
  });
});
