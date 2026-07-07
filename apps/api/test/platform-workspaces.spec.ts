import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handlePlatformWorkspaces } from "../src/routes/platform/workspaces.ts";

function makeMockReq(headers: Record<string, string | undefined>) {
  return { headers } as any;
}

function makeMockRes() {
  let status = 0;
  let body = "";
  return {
    writeHead: (s: number, _h: Record<string, string>) => {
      status = s;
    },
    end: (b: string) => {
      body = b;
    },
    _get: () => ({ status, body: body ? JSON.parse(body) : {} }),
  } as any;
}

describe("platform workspaces handler", () => {
  it("401 when missing auth", async () => {
    const req = makeMockReq({});
    const res = makeMockRes();
    await handlePlatformWorkspaces(req, res);
    const out = res._get();
    assert.equal(out.status, 401);
  });

  it("200 and has denali with auth", async () => {
    process.env.PLATFORM_OPS_PHONES = "+1";
    const req = makeMockReq({ Authorization: "Bearer platform-ops", "X-Platform-Ops-Phone": "+1" });
    const res = makeMockRes();
    await handlePlatformWorkspaces(req, res);
    const out = res._get();
    assert.equal(out.status, 200);
    const ids = out.body.workspaces.map((w: any) => w.id);
    assert.ok(ids.includes("denali"));
  });
});
