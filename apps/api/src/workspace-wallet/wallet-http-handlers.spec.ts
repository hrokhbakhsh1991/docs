/**
 * WALLET-P2D — wallet HTTP handler boundary tests.
 */
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, it } from "node:test";

import {
  configureWalletHttpHost,
  handleWalletMemberBalance,
  handleWalletMemberOwnBalance,
  handleWalletMemberOwnTransactions,
  handleWalletOperatorAccounts,
  handleWalletOperatorCredit,
  handleWalletOperatorDebit,
  resetWalletHttpHostForTests,
} from "@app-tour/wallet-http";

import { handleHttpError } from "../middleware/error-interceptor.ts";
import { runWithTraceContext } from "../observability/trace-request-context.ts";
import {
  createFakeWalletService,
  WALLET_HTTP_TEST_ACCOUNT_ID,
  WALLET_MEMBER_AUTH,
  WALLET_OPERATOR_AUTH,
} from "./wallet-service-host-fakes.ts";

type HostState = {
  auth: typeof WALLET_MEMBER_AUTH;
  idempotencyKey?: string;
  body: Record<string, unknown>;
  rawBody: string;
  store: Map<string, Record<string, unknown> & { __hash: string }>;
};

function createMockRes(): ServerResponse & { statusCode: number; body: string } {
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

describe("WALLET-P2D wallet HTTP handlers", () => {
  let hostState: HostState;
  let walletService: ReturnType<typeof createFakeWalletService>;

  beforeEach(() => {
    resetWalletHttpHostForTests();
    walletService = createFakeWalletService();
    hostState = {
      auth: WALLET_MEMBER_AUTH,
      body: { amountMinor: "1000", currency: "IRR" },
      rawBody: JSON.stringify({ amountMinor: "1000", currency: "IRR" }),
      store: new Map(),
    };

    configureWalletHttpHost({
      runWithHttpRequestContext: async (_req, _auth, fn) => fn(),
      sendJson: (res, status, body) => {
        const payload = JSON.stringify(body);
        (res as ServerResponse & { statusCode: number }).statusCode = status;
        (res as ServerResponse & { body: string }).body = payload;
        (res as ServerResponse & { writableEnded: boolean }).writableEnded = true;
      },
      handleHttpError: (res, error) => {
        void runWithTraceContext("wallet-http-trace", () => {
          handleHttpError(res, error);
        });
      },
      resolveTenantContextFromRequest: async () => hostState.auth,
      readWalletRequestBody: async () => ({
        parsedBody: hostState.body,
        rawBody: hostState.rawBody,
      }),
      resolveWalletService: async () => walletService,
      readIdempotencyKey: () => hostState.idempotencyKey,
      hashIdempotentRequest: (_method, path, rawBody) => `${path}:${rawBody}`,
      runIdempotentHttpMutation: async (tenantId, key, requestHash, execute) => {
        const mapKey = `${tenantId}:${key}`;
        const existing = hostState.store.get(mapKey);
        if (existing !== undefined) {
          if (existing.__hash !== requestHash) {
            throw new Error("IDEMPOTENCY_PAYLOAD_MISMATCH");
          }
          const { __hash: _drop, ...body } = existing;
          return body as Awaited<ReturnType<typeof execute>>;
        }
        const created = await execute();
        hostState.store.set(mapKey, { ...created, __hash: requestHash });
        return created;
      },
      idempotencyKeyRequiredCode: "IDEMPOTENCY_KEY_REQUIRED",
    });
  });

  it("returns member balance for entitled member", async () => {
    const res = createMockRes();
    await handleWalletMemberBalance(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { balanceMinor: string };
    assert.equal(body.balanceMinor, "5000");
  });

  it("returns member own balance without account id in path", async () => {
    const res = createMockRes();
    await handleWalletMemberOwnBalance({} as IncomingMessage, res, { walletService });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as {
      balanceMinor: string;
      availableBalanceMinor: string;
    };
    assert.equal(body.balanceMinor, "5000");
    assert.equal(body.availableBalanceMinor, "5000");
  });

  it("returns member own transactions without account id in path", async () => {
    const res = createMockRes();
    await handleWalletMemberOwnTransactions({} as IncomingMessage, res, { walletService });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { items: unknown[] };
    assert.ok(Array.isArray(body.items));
  });

  it("rejects unsupported workspace", async () => {
    walletService.state.workspaceSupported = false;
    const res = createMockRes();
    await handleWalletMemberBalance(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { code: string };
    assert.equal(body.code, "WALLET_WORKSPACE_UNSUPPORTED");
  });

  it("rejects disabled wallet module", async () => {
    walletService.state.moduleEnabled = false;
    const res = createMockRes();
    await handleWalletMemberBalance(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body) as { code: string };
    assert.equal(body.code, "FORBIDDEN_WALLET_MODULE_DISABLED");
  });

  it("rejects member without wallet entitlement", async () => {
    walletService.state.memberEntitled = false;
    const res = createMockRes();
    await handleWalletMemberBalance(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body) as { code: string };
    assert.equal(body.code, "FORBIDDEN_MEMBER_MODULE_WALLET");
  });

  it("rejects member mutation attempts", async () => {
    hostState.auth = WALLET_MEMBER_AUTH;
    hostState.idempotencyKey = "credit-member-attempt";
    const res = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 403);
  });

  it("requires Idempotency-Key for operator credit", async () => {
    hostState.auth = WALLET_OPERATOR_AUTH;
    hostState.idempotencyKey = undefined;
    const res = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body) as { code: string };
    assert.equal(body.code, "IDEMPOTENCY_KEY_REQUIRED");
  });

  it("operator credit succeeds with idempotency replay", async () => {
    hostState.auth = WALLET_OPERATOR_AUTH;
    hostState.idempotencyKey = "credit-op-1";
    const res1 = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res1,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res1.statusCode, 201);

    const res2 = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res2,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res2.statusCode, 201);
    const body1 = JSON.parse(res1.body) as { transactionId: string };
    const body2 = JSON.parse(res2.body) as { transactionId: string };
    assert.equal(body2.transactionId, body1.transactionId);
  });

  it("idempotency conflict on different command fingerprint", async () => {
    hostState.auth = WALLET_OPERATOR_AUTH;
    hostState.idempotencyKey = "credit-conflict";
    const res1 = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res1,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res1.statusCode, 201);

    hostState.rawBody = JSON.stringify({ amountMinor: "2000", currency: "IRR" });
    hostState.body = { amountMinor: "2000", currency: "IRR" };
    const res2 = createMockRes();
    await handleWalletOperatorCredit(
      {} as IncomingMessage,
      res2,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.body) as { code: string };
    assert.equal(body2.code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
  });

  it("maps insufficient funds on operator debit", async () => {
    hostState.auth = WALLET_OPERATOR_AUTH;
    hostState.idempotencyKey = "debit-insufficient";
    walletService.state.insufficientFunds = true;
    const res = createMockRes();
    await handleWalletOperatorDebit(
      {} as IncomingMessage,
      res,
      { walletService },
      WALLET_HTTP_TEST_ACCOUNT_ID,
    );
    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.body) as { code: string };
    assert.equal(body.code, "WALLET_INSUFFICIENT_FUNDS");
  });

  it("operator account lookup succeeds", async () => {
    hostState.auth = WALLET_OPERATOR_AUTH;
    const res = createMockRes();
    const req = {
      url: `/wallet/accounts?userId=${WALLET_MEMBER_AUTH.userId}`,
    } as IncomingMessage;
    await handleWalletOperatorAccounts(req, res, { walletService });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body) as { items: unknown[] };
    assert.equal(body.items.length, 1);
  });

  it("stable error envelope shape on domain failure", async () => {
    hostState.auth = WALLET_MEMBER_AUTH;
    const res = createMockRes();
    await handleWalletMemberBalance(
      {} as IncomingMessage,
      res,
      { walletService },
      "00000000-0000-4000-8000-000000009999",
    );
    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body) as { error: string; code: string; correlationId: string };
    assert.equal(typeof body.error, "string");
    assert.equal(body.code, "WALLET_OWNERSHIP_MISMATCH");
    assert.equal(typeof body.correlationId, "string");
    assert.equal(body.error.includes("Prisma"), false);
  });
});
