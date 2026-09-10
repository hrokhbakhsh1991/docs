/**
 * WALLET-MEG — dashboard wallet summary mapping.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MemberWalletFetchResult } from "../src/me/wallet/fetch-member-wallet.server";
import { mapMemberDashboardWalletSummaryFromFetch } from "../src/me/wallet/member-dashboard-wallet-summary.server";

const okPayload: Extract<MemberWalletFetchResult, { status: "ok" }>["payload"] = {
  ok: true,
  balance: {
    accountId: "acc-1",
    currency: "IRR",
    balanceMinor: "40000",
    availableBalanceMinor: "40000",
    balanceLabel: "۴۰٬۰۰۰ ریال",
    availableLabel: "۴۰٬۰۰۰ ریال",
  },
  history: {
    items: [
      {
        id: "tx-1",
        kind: "operator_credit",
        amountMinor: "50000",
        currency: "IRR",
        postedAt: "2026-01-01T00:00:00.000Z",
        direction: "incoming",
        formattedAmount: "۵۰٬۰۰۰ ریال",
      },
    ],
    nextCursor: null,
    hasMore: false,
  },
};

describe("member-dashboard-wallet-summary", () => {
  it("maps ok wallet BFF to ready summary", () => {
    const summary = mapMemberDashboardWalletSummaryFromFetch({
      status: "ok",
      payload: okPayload,
    });
    assert.equal(summary.state, "ready");
    if (summary.state === "ready") {
      assert.match(summary.balanceLabel, /ریال/);
      assert.equal(summary.currency, "IRR");
      assert.equal(summary.lastTransactionKind, "operator_credit");
      assert.match(summary.lastTransactionLabel ?? "", /ریال/);
    }
  });

  it("maps disabled and entitlement states to hidden", () => {
    for (const status of [
      "workspace_disabled",
      "module_disabled",
      "entitlement_denied",
      "missing_cookie",
      "unauthenticated",
    ] as const) {
      const summary = mapMemberDashboardWalletSummaryFromFetch({ status });
      assert.equal(summary.state, "hidden");
    }
  });

  it("maps upstream failures to error state", () => {
    for (const status of ["unavailable", "api_error"] as const) {
      const summary = mapMemberDashboardWalletSummaryFromFetch({ status });
      assert.equal(summary.state, "error");
    }
  });
});
