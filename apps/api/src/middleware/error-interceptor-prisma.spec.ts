import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  handleHttpError,
  isClientSafeErrorToken,
  mapPrismaErrorToAppError,
} from "./error-interceptor";
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

function runHandle(res: ServerResponse, error: unknown): void {
  void runWithTraceContext("trace-ap14-prisma", () => {
    handleHttpError(res, error);
  });
}

describe("error-interceptor Prisma mapping (AP14 Faz 4)", () => {
  it("AP14-PRISMA-01 maps P2002 to 409 UNIQUE_CONSTRAINT_VIOLATION", () => {
    const mapped = mapPrismaErrorToAppError(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    assert.deepEqual(mapped, {
      status: 409,
      error: "conflict",
      code: "UNIQUE_CONSTRAINT_VIOLATION",
    });

    const res = createMockResponse();
    runHandle(
      res,
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", {
        code: "P2002",
        clientVersion: "test",
      })
    );
    assert.equal(res.statusCode, 409);
    const payload = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(payload.code, "UNIQUE_CONSTRAINT_VIOLATION");
    assert.equal(payload.error, "conflict");
    assert.doesNotMatch(res.body, /Unique constraint/i);
  });

  it("AP14-PRISMA-02 maps P2003 to 422 FOREIGN_KEY_VIOLATION", () => {
    const res = createMockResponse();
    runHandle(
      res,
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "test",
      })
    );
    assert.equal(res.statusCode, 422);
    const payload = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(payload.code, "FOREIGN_KEY_VIOLATION");
    assert.equal(payload.error, "foreign_key_violation");
  });

  it("AP14-PRISMA-03 maps P2025 to 404 RECORD_NOT_FOUND", () => {
    const res = createMockResponse();
    runHandle(
      res,
      new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
        code: "P2025",
        clientVersion: "test",
      })
    );
    assert.equal(res.statusCode, 404);
    const payload = JSON.parse(res.body) as { code?: string; error?: string };
    assert.equal(payload.code, "RECORD_NOT_FOUND");
    assert.equal(payload.error, "not_found");
  });

  it("AP14-PRISMA-04 unmapped Prisma known error is opaque 500", () => {
    const res = createMockResponse();
    runHandle(
      res,
      new Prisma.PrismaClientKnownRequestError("Raw query failed", {
        code: "P2010",
        clientVersion: "test",
      })
    );
    assert.equal(res.statusCode, 500);
    const payload = JSON.parse(res.body) as { error?: string };
    assert.equal(payload.error, "internal_error");
    assert.doesNotMatch(res.body, /Raw query/i);
  });

  it("AP14-PRISMA-05 domain tokens pass isClientSafeErrorToken", () => {
    assert.equal(isClientSafeErrorToken("TOUR_NOT_FOUND"), true);
    assert.equal(isClientSafeErrorToken("validation_failed"), true);
    assert.equal(isClientSafeErrorToken("Unique constraint failed"), false);
  });

  it("AP14-PRISMA-06 domain TOUR_NOT_FOUND still maps to 404", () => {
    const res = createMockResponse();
    runHandle(res, new Error("TOUR_NOT_FOUND"));
    assert.equal(res.statusCode, 404);
    const payload = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(payload.error, "TOUR_NOT_FOUND");
  });

  it("AP14-PRISMA-07 ZOD_VALIDATION_FAILED returns 400 before opaque-token gate", () => {
    const message =
      "ZOD_VALIDATION_FAILED: urban.catalog.slug: Invalid slug (expected lowercase alphanumeric)";
    const res = createMockResponse();
    runHandle(res, new Error(message));
    assert.equal(res.statusCode, 400);
    const payload = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(payload.code, "ZOD_VALIDATION_FAILED");
    assert.equal(payload.error, message);
    assert.equal(isClientSafeErrorToken(message), false);
  });

  it("AP14-PRISMA-08 CANONICAL_VALIDATION_FAILED returns 400 with stable code", () => {
    const message = "CANONICAL_VALIDATION_FAILED: tour.title: required";
    const res = createMockResponse();
    runHandle(res, new Error(message));
    assert.equal(res.statusCode, 400);
    const payload = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(payload.code, "CANONICAL_VALIDATION_FAILED");
    assert.equal(payload.error, message);
  });
});
