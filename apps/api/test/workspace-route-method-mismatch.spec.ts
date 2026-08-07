import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  collectWorkspaceRouteMethodsForPath,
  tryDispatchWorkspaceRoutes,
} from "../src/http/workspace-route-registrar";
import { runWithTraceContext } from "../src/observability/trace-request-context";

describe("workspace route method mismatch", () => {
  it("lists PATCH for finance receipt review path", () => {
    const methods = collectWorkspaceRouteMethodsForPath(
      "/finance/receipts/00000000-0000-4000-8000-000000000925/review"
    );
    assert.deepEqual([...methods].sort(), ["PATCH"]);
  });

  it("returns 405 METHOD_NOT_ALLOWED when POST hits PATCH-only review path", async () => {
    const headers: Record<string, string> = {};
    let statusCode = 0;
    let body = "";
    const res = {
      writableEnded: false,
      statusCode: 0,
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      writeHead(code: number) {
        statusCode = code;
        this.statusCode = code;
        return res;
      },
      end(chunk?: unknown) {
        if (statusCode === 0 && typeof this.statusCode === "number" && this.statusCode > 0) {
          statusCode = this.statusCode;
        }
        body = typeof chunk === "string" ? chunk : chunk == null ? "" : String(chunk);
        (res as { writableEnded: boolean }).writableEnded = true;
      },
    } as unknown as ServerResponse;

    const handled = await runWithTraceContext("test-workspace-method-mismatch", async () =>
      tryDispatchWorkspaceRoutes(
        "POST",
        "/finance/receipts/00000000-0000-4000-8000-000000000925/review",
        {} as IncomingMessage,
        res,
        async () => {
          throw new Error("handler must not run on method mismatch");
        },
        {}
      )
    );

    assert.equal(handled, true);
    const finalStatus =
      statusCode > 0 ? statusCode : Number((res as unknown as { statusCode?: number }).statusCode ?? 0);
    assert.equal(finalStatus, 405);
    assert.match(headers.allow ?? "", /PATCH/);
    const parsed = JSON.parse(body) as { error: string; code: string };
    assert.equal(parsed.error, "method_not_allowed");
    assert.equal(parsed.code, "METHOD_NOT_ALLOWED");
  });

  it("does not claim unknown finance paths", () => {
    const methods = collectWorkspaceRouteMethodsForPath("/finance/not-a-real-route");
    assert.equal(methods.size, 0);
  });
});
