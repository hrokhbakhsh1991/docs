import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { tryDispatchPlatformRoutes } from "../src/http/platform-route-registrar.ts";

describe("app.ts platform dispatch", () => {
  it("401 - GET /platform/v1/tenants returns 401 without auth", async () => {
    const mockReq = { headers: {} } as any;
    const mockRes = {
      writeHead: (status: number, _headers: unknown) => {
        mockRes.statusCode = status;
      },
      end: (_data: string) => {},
      statusCode: 0,
    } as any;

    const handled = await tryDispatchPlatformRoutes("GET", "/platform/v1/tenants", mockReq, mockRes);

    assert.strictEqual(handled, true, "Should handle platform route");
    assert.strictEqual(mockRes.statusCode, 401, "Should return 401 for unauthenticated request");
  });

  it("404 unknown - GET /platform/v1/unknown returns 404", async () => {
    const mockReq = {} as any;
    const chunks: Buffer[] = [];
    const mockRes = {
      writeHead: (status: number, headers: any) => {
        mockRes.statusCode = status;
      },
      end: (data: string) => {
        chunks.push(Buffer.from(data));
      },
      statusCode: 0
    } as any;

    const handled = await tryDispatchPlatformRoutes("GET", "/platform/v1/unknown", mockReq, mockRes);

    assert.strictEqual(handled, true, "Should handle platform route");
    assert.strictEqual(mockRes.statusCode, 404, "Should return 404 for unknown platform route");
  });
});

// Made with Bob
