/**
 * WALLET-P3B — operator wallet ops logic tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildWalletAccountsSearchPath,
  buildWalletCreditRequestBody,
  buildWalletDebitRequestBody,
  buildWalletReversalRequestBody,
  canReverseWalletTransaction,
  createWalletIdempotencyKey,
  mapWalletMutationHttpError,
  paginateWalletAccounts,
  parseWalletAccountsResponse,
  parseWalletMutationResponse,
  validateMemberUserIdSearch,
  validateWalletMutationForm,
  validateWalletReversalForm,
  walletUiMustNotSendAuthorityFields,
} from "../src/wallet/wallet-ops-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("wallet-ops-logic.spec.ts — WALLET-P3B", () => {
  it("WEB-WALLET-OPS-01 member userId search validates UUID", () => {
    assert.equal(validateMemberUserIdSearch("not-a-uuid").ok, false);
    assert.equal(
      validateMemberUserIdSearch("00000000-0000-4000-8000-000000000099").ok,
      true,
    );
  });

  it("WEB-WALLET-OPS-02 credit/debit validation requires positive minor amount and reason", () => {
    assert.equal(
      validateWalletMutationForm({ amountMinor: "0", reasonNote: "ops" }, "IRR").ok,
      false,
    );
    assert.equal(
      validateWalletMutationForm({ amountMinor: "100", reasonNote: "" }, "IRR").ok,
      false,
    );
    const ok = validateWalletMutationForm({ amountMinor: "100", reasonNote: "adjustment" }, "IRR");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.currency, "IRR");
    }
  });

  it("WEB-WALLET-OPS-03 reversal validation requires reason", () => {
    assert.equal(validateWalletReversalForm({ reasonNote: "" }).ok, false);
    assert.equal(validateWalletReversalForm({ reasonNote: "mistake" }).ok, true);
  });

  it("WEB-WALLET-OPS-04 mutation bodies never include tenant/workspace authority", () => {
    const credit = buildWalletCreditRequestBody({
      amountMinor: "100",
      currency: "IRR",
      reasonNote: "bonus",
    });
    assert.doesNotMatch(credit, /tenantId/);
    assert.doesNotMatch(credit, /workspaceId/);
    const reversal = buildWalletReversalRequestBody({
      accountId: "00000000-0000-4000-8000-000000000020",
      reasonNote: "fix",
    });
    assert.doesNotMatch(reversal, /tenantId/);
    assert.doesNotMatch(reversal, /userId/);
  });

  it("WEB-WALLET-OPS-05 idempotency key is stable per submission prefix", () => {
    const keyA = createWalletIdempotencyKey("credit-test");
    const keyB = createWalletIdempotencyKey("credit-test");
    assert.notEqual(keyA, keyB);
    assert.ok(keyA.length >= 8);
  });

  it("WEB-WALLET-OPS-06 maps insufficient funds and idempotency conflict", () => {
    assert.equal(
      mapWalletMutationHttpError(409, { code: "WALLET_INSUFFICIENT_FUNDS" }),
      "WALLET_INSUFFICIENT_FUNDS",
    );
    assert.equal(
      mapWalletMutationHttpError(409, { code: "WALLET_IDEMPOTENCY_CONFLICT" }),
      "WALLET_IDEMPOTENCY_CONFLICT",
    );
  });

  it("WEB-WALLET-OPS-07 parses replay mutation response", () => {
    const parsed = parseWalletMutationResponse({
      transactionId: "00000000-0000-4000-8000-000000000030",
      accountId: "00000000-0000-4000-8000-000000000020",
      kind: "operator_credit",
      status: "posted",
      amountMinor: "100",
      currency: "IRR",
      postedAt: "2026-09-02T10:00:00.000Z",
      replay: true,
    });
    assert.equal(parsed?.replay, true);
  });

  it("WEB-WALLET-OPS-08 account pagination slices client-side", () => {
    const items = Array.from({ length: 7 }, (_, index) => ({ id: String(index) }));
    const page1 = paginateWalletAccounts(items, 1, 3);
    assert.equal(page1.pageItems.length, 3);
    assert.equal(page1.totalPages, 3);
    const page3 = paginateWalletAccounts(items, 3, 3);
    assert.equal(page3.pageItems.length, 1);
  });

  it("WEB-WALLET-OPS-09 reversal allowed only for non-reversal posted rows", () => {
    assert.equal(
      canReverseWalletTransaction({
        id: "1",
        accountId: "a",
        kind: "operator_credit",
        status: "posted",
        amountMinor: "1",
        currency: "IRR",
        reference: null,
        reversesTransactionId: null,
        postedAt: "2026-09-02T10:00:00.000Z",
      }),
      true,
    );
    assert.equal(
      canReverseWalletTransaction({
        id: "2",
        accountId: "a",
        kind: "reversal",
        status: "posted",
        amountMinor: "1",
        currency: "IRR",
        reference: null,
        reversesTransactionId: "1",
        postedAt: "2026-09-02T10:00:00.000Z",
      }),
      false,
    );
  });

  it("WEB-WALLET-OPS-10 accounts search path uses userId only (no workspaceId)", () => {
    const path = buildWalletAccountsSearchPath("00000000-0000-4000-8000-000000000099");
    assert.match(path, /userId=/);
    assert.doesNotMatch(path, /workspaceId=/);
    assert.doesNotMatch(path, /tenantId=/);
  });

  it("WEB-WALLET-OPS-11 BFF routes proxy upstream without authority query params", () => {
    const accountsRoute = readFileSync(
      resolve(WEB_ROOT, "app/api/wallet/accounts/route.ts"),
      "utf8",
    );
    const proxy = readFileSync(resolve(WEB_ROOT, "src/wallet/proxy-wallet-api.server.ts"), "utf8");
    assert.match(accountsRoute, /proxyWalletApiGet/);
    assert.doesNotMatch(accountsRoute, /workspaceId/);
    assert.match(proxy, /Idempotency-Key/);
  });

  it("WEB-WALLET-OPS-12 panel uses confirmation dialog and idempotency key ref", () => {
    const panel = readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-ops-panel.tsx"), "utf8");
    assert.match(panel, /Dialog/);
    assert.match(panel, /createWalletIdempotencyKey/);
    assert.match(panel, /idempotencyKeyRef/);
    assert.match(panel, /mutationPending/);
    assert.match(panel, /refreshSelectedAccount/);
    assert.doesNotMatch(panel, /optimistic/i);
  });

  it("WEB-WALLET-OPS-13 no Denali or Finance imports in shared wallet UI", () => {
    const sources = [
      readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-ops-panel.tsx"), "utf8"),
      readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-ops-logic.ts"), "utf8"),
      readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-nav-registry.ts"), "utf8"),
      readFileSync(resolve(WEB_ROOT, "app/api/wallet/accounts/route.ts"), "utf8"),
    ].join("\n");
    assert.doesNotMatch(sources, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(sources, /@app-tour\/finance-core/);
    assert.doesNotMatch(sources, /pluginId\s*===\s*["']denali["']/);
    const mutationBodies = [
      buildWalletCreditRequestBody({
        amountMinor: "100",
        currency: "IRR",
        reasonNote: "bonus",
      }),
      buildWalletReversalRequestBody({
        accountId: "00000000-0000-4000-8000-000000000020",
        reasonNote: "fix",
      }),
    ].join("\n");
    assert.doesNotMatch(mutationBodies, /tenantId/);
    assert.doesNotMatch(mutationBodies, /workspaceId/);
    assert.doesNotMatch(mutationBodies, /userId/);
  });

  it("WEB-WALLET-OPS-14 parseWalletAccountsResponse handles list shape", () => {
    const parsed = parseWalletAccountsResponse({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000020",
          userId: "00000000-0000-4000-8000-000000000099",
          workspaceId: "wallet-ws1",
          currency: "IRR",
          status: "active",
          balanceMinor: "0",
        },
      ],
    });
    assert.equal(parsed?.items.length, 1);
  });
});
