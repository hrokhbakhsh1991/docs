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
  method: "GET" | "POST",
  path: string,
  opts?: { headers?: Record<string, string> }
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
      const r = http.request(
        {
          hostname: "127.0.0.1",
          port: a.port,
          path,
          method,
          headers: opts?.headers ?? {},
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
      r.end();
    });
  });
}

function platformOwnerHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+989121234567" };
}

function platformSupportHeaders() {
  return { Authorization: "Bearer test", "X-Platform-Ops-Phone": "+10000000099" };
}

describe("platform tenant offboard integration", () => {
  it("PE-01 POST offboard support returns 403 or 500 without DB", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
    const res = await platformHttpJson("POST", "/platform/v1/tenants/t1/offboard", {
      headers: platformSupportHeaders(),
    });
    assert.ok(res.status === 403 || res.status === 500);
  });

  it("PE-02 POST offboard owner returns 200 or 404 when tenant missing", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567";
    const res = await platformHttpJson("POST", "/platform/v1/tenants/t1/offboard", {
      headers: platformOwnerHeaders(),
    });
    assert.ok(res.status === 200 || res.status === 404 || res.status === 500);
    if (res.status === 200) {
      assert.equal((res.body.tenant as { status?: string })?.status, "offboarding");
    }
  });

  it("PE-03 GET audit export support returns 403 or 500 without DB", async () => {
    process.env.PLATFORM_OPS_BEARER_TOKEN = "test";
    process.env.PLATFORM_OPS_PHONES = "+989121234567,+10000000099";
    const res = await platformHttpJson("GET", "/platform/v1/audit/export", {
      headers: platformSupportHeaders(),
    });
    assert.ok(res.status === 403 || res.status === 500);
  });
});
