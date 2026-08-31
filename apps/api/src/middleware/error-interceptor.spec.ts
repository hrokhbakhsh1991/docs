import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { join } from "node:path";
import { describe, it } from "node:test";

import { handleHttpError, resolveCorrelationId } from "./error-interceptor";
import { runWithTraceContext } from "../observability/trace-request-context";
import { WORKSPACE_TYPE_UNRESOLVED } from "../tenant/resolve-workspace-type";
import { FINANCE_WORKSPACE_UNSUPPORTED } from "../workspace-finance/resolve-finance-workspace-type-for-tenant";

describe("resolveCorrelationId (TRACE-REGEN-02 / DEC-126)", () => {
  it("requires trace ALS — no randomUUID fallback", () => {
    assert.throws(() => resolveCorrelationId(), /TRACE_CONTEXT_NOT_BOUND/);
  });

  it("returns active trace id when ALS is bound", () => {
    void runWithTraceContext("ingress-trace-abc", () => {
      assert.equal(resolveCorrelationId(), "ingress-trace-abc");
    });
  });
});

describe("handleHttpError — WORKSPACE_TYPE_UNRESOLVED (PREV-AUD-013)", () => {
  function createMockResponse(): ServerResponse & {
    statusCode: number;
    body: string;
  } {
    return {
      statusCode: 0,
      body: "",
      writableEnded: false,
      setHeader() {},
      end(payload?: string) {
        if (payload !== undefined) {
          this.body = payload;
        }
        this.writableEnded = true;
      },
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps WORKSPACE_TYPE_UNRESOLVED:<uuid> to 404 with stable code (not INTERNAL_ERROR)", () => {
    const res = createMockResponse();
    const tenantId = "00000000-0000-4000-8000-00000000dead";
    void runWithTraceContext("ws-unresolved-trace", () => {
      handleHttpError(res, new Error(`${WORKSPACE_TYPE_UNRESOLVED}:${tenantId}`));
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, WORKSPACE_TYPE_UNRESOLVED);
    assert.equal(body.code, WORKSPACE_TYPE_UNRESOLVED);
    assert.equal(res.body.includes(tenantId), false);
  });
});

describe("handleHttpError — FINANCE_WORKSPACE_UNSUPPORTED (urban fail-closed)", () => {
  function createMockResponse(): ServerResponse & {
    statusCode: number;
    body: string;
  } {
    return {
      statusCode: 0,
      body: "",
      writableEnded: false,
      setHeader() {},
      end(payload?: string) {
        if (payload !== undefined) {
          this.body = payload;
        }
        this.writableEnded = true;
      },
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps FINANCE_WORKSPACE_UNSUPPORTED: workspaceType=urban to 404 stable code (not 500)", () => {
    const res = createMockResponse();
    void runWithTraceContext("finance-unsupported-trace", () => {
      handleHttpError(res, new Error(`${FINANCE_WORKSPACE_UNSUPPORTED}: workspaceType=urban`));
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, FINANCE_WORKSPACE_UNSUPPORTED);
    assert.equal(body.code, FINANCE_WORKSPACE_UNSUPPORTED);
    assert.equal(res.body.includes("workspaceType"), false);
  });
});

describe("handleHttpError — generic forbidden domain tokens", () => {
  function createMockResponse(): ServerResponse & {
    statusCode: number;
    body: string;
  } {
    return {
      statusCode: 0,
      body: "",
      writableEnded: false,
      setHeader() {},
      end(payload?: string) {
        if (payload !== undefined) {
          this.body = payload;
        }
        this.writableEnded = true;
      },
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps any safe *_FORBIDDEN token to 403 without product-specific branches", () => {
    const res = createMockResponse();
    void runWithTraceContext("generic-forbidden-trace", () => {
      handleHttpError(res, new Error("ALPINE_PHOTO_REMINT_DEST_FORBIDDEN"));
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, "ALPINE_PHOTO_REMINT_DEST_FORBIDDEN");
    assert.equal(body.code, "ALPINE_PHOTO_REMINT_DEST_FORBIDDEN");

    const source = readFileSync(join(import.meta.dirname, "error-interceptor.ts"), "utf8");
    assert.doesNotMatch(source, /DENALI_PHOTO_REMINT_DEST_FORBIDDEN/);
    assert.match(source, /_FORBIDDEN/);
  });
});

describe("handleHttpError — mapper source hygiene", () => {
  it("does not duplicate workspace registration invalid branches", () => {
    const source = readFileSync(join(import.meta.dirname, "error-interceptor.ts"), "utf8");
    const urbanRegistrationInvalidBranches = source.match(
      /message\.startsWith\("URBAN_REGISTRATION_INVALID"\)/g
    );

    assert.equal(urbanRegistrationInvalidBranches?.length, 1);
  });
});

describe("handleHttpError — PR23-A3 payment cancel mapping", () => {
  function createMockResponse(): ServerResponse & {
    statusCode: number;
    body: string;
  } {
    return {
      statusCode: 0,
      body: "",
      writableEnded: false,
      setHeader() {},
      end(payload?: string) {
        if (payload !== undefined) {
          this.body = payload;
        }
        this.writableEnded = true;
      },
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps PAYMENT_NOT_IN_SCOPE to 404 PAYMENT_NOT_FOUND without leak", () => {
    const res = createMockResponse();
    void runWithTraceContext("cancel-scope-trace", () => {
      handleHttpError(res, new Error("PAYMENT_NOT_IN_SCOPE"));
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, "PAYMENT_NOT_FOUND");
    assert.equal(body.code, "PAYMENT_NOT_FOUND");
    assert.equal(res.body.includes("NOT_IN_SCOPE"), false);
  });

  it("maps PAYMENT_HAS_PENDING_RECEIPT to 409", () => {
    const res = createMockResponse();
    void runWithTraceContext("cancel-receipt-trace", () => {
      handleHttpError(res, new Error("PAYMENT_HAS_PENDING_RECEIPT"));
    });
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "PAYMENT_HAS_PENDING_RECEIPT");
  });

  it("maps PAYMENT_CANCEL_REASON_INVALID to 400", () => {
    const res = createMockResponse();
    void runWithTraceContext("cancel-reason-trace", () => {
      handleHttpError(res, new Error("PAYMENT_CANCEL_REASON_INVALID"));
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "PAYMENT_CANCEL_REASON_INVALID");
  });

  it("maps REFUND_NOT_FOUND to 404", () => {
    const res = createMockResponse();
    void runWithTraceContext("refund-not-found-trace", () => {
      handleHttpError(res, new Error("REFUND_NOT_FOUND"));
    });
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { code?: string };
    assert.equal(body.code, "REFUND_NOT_FOUND");
  });

  it("maps REFUND_REASON_INVALID to 400", () => {
    const res = createMockResponse();
    void runWithTraceContext("refund-reason-trace", () => {
      handleHttpError(res, new Error("REFUND_REASON_INVALID"));
    });
    assert.equal(res.statusCode, 400);
  });

  it("maps REFUND_OVER_CAP to 409", () => {
    const res = createMockResponse();
    void runWithTraceContext("refund-over-cap-trace", () => {
      handleHttpError(res, new Error("REFUND_OVER_CAP"));
    });
    assert.equal(res.statusCode, 409);
  });
});

describe("handleHttpError — FINANCE_OBLIGATION_OVERPAY (PR20-D)", () => {
  function createMockResponse(): ServerResponse & {
    statusCode: number;
    body: string;
  } {
    return {
      statusCode: 0,
      body: "",
      writableEnded: false,
      setHeader() {},
      end(payload?: string) {
        if (payload !== undefined) {
          this.body = payload;
        }
        this.writableEnded = true;
      },
    } as unknown as ServerResponse & { statusCode: number; body: string };
  }

  it("maps FINANCE_OBLIGATION_OVERPAY to 422 with stable code (not 500)", () => {
    const res = createMockResponse();
    void runWithTraceContext("finance-overpay-trace", () => {
      handleHttpError(res, new Error("FINANCE_OBLIGATION_OVERPAY"));
    });
    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.body) as { error?: string; code?: string };
    assert.equal(body.error, "FINANCE_OBLIGATION_OVERPAY");
    assert.equal(body.code, "FINANCE_OBLIGATION_OVERPAY");
  });
});
