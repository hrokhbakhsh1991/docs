import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { ServerResponse } from "node:http";
import { describe, it } from "node:test";

import { DATABASE_UNAVAILABLE } from "../db/database-connection-error";
import { handleHttpError } from "./error-interceptor";
import { runWithTraceContext } from "../observability/trace-request-context";

function createMockResponse(): ServerResponse & {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  const headers: Record<string, string> = {};
  return {
    statusCode: 0,
    headers,
    body: "",
    writableEnded: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(payload?: string) {
      if (payload !== undefined) {
        this.body = payload;
      }
      this.writableEnded = true;
    },
  } as unknown as ServerResponse & {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  };
}

describe("error-interceptor DATABASE_UNAVAILABLE (API-DB-CONN-05)", () => {
  it("API-DB-CONN-05 maps Prisma auth failure to 503 DATABASE_UNAVAILABLE", () => {
    const Ctor = Prisma.PrismaClientKnownRequestError;
    if (typeof Ctor !== "function") {
      return;
    }
    const res = createMockResponse();
    const error = new Ctor("auth failed", {
      code: "P1000",
      clientVersion: "test",
    });

    void runWithTraceContext("trace-db-unavail", () => {
      handleHttpError(res, error);
    });

    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["retry-after"], "30");
    const payload = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(payload.code, DATABASE_UNAVAILABLE);
    assert.equal(payload.error, "database_unavailable");
  });

  it("API-DB-CONN-07 maps workspace invalid token to 400 JSON without crashing", () => {
    const res = createMockResponse();

    void runWithTraceContext("trace-ws-invalid", () => {
      handleHttpError(res, new Error("DENALI_REGISTRATION_INVALID"));
    });

    assert.equal(res.statusCode, 400);
    const payload = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(payload.code, "DENALI_REGISTRATION_INVALID");
    assert.equal(payload.error, "DENALI_REGISTRATION_INVALID");
  });
});
