import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allowsOperatorFinanceReceiptReviewTeamAccess } from "../src/finance/resolve-operator-finance-middleware-access";

describe("resolve-operator-finance-middleware-access", () => {
  it("allows Admin PATCH only for a finance receipt review BFF path", () => {
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "admin",
        "/api/finance/receipts/receipt-123/review",
        "PATCH"
      ),
      true
    );
  });

  it("rejects other roles, methods, and finance paths", () => {
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "viewer",
        "/api/finance/receipts/receipt-123/review",
        "PATCH"
      ),
      false
    );
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "member",
        "/api/finance/receipts/receipt-123/review",
        "PATCH"
      ),
      false
    );
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "admin",
        "/api/finance/receipts/receipt-123/review",
        "GET"
      ),
      false
    );
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "admin",
        "/api/auth/membership-ability-context",
        "GET"
      ),
      false
    );
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "admin",
        "/api/finance/receipts/receipt-123/url",
        "PATCH"
      ),
      false
    );
    assert.equal(
      allowsOperatorFinanceReceiptReviewTeamAccess(
        "admin",
        "/api/finance/receipts/receipt-123/review/extra",
        "PATCH"
      ),
      false
    );
  });
});
