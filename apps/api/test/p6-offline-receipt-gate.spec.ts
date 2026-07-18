/**
 * P6-2-N-014 — offline_receipt enforcement gate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("p6-offline-receipt-gate", () => {
  it("P6-OR-01 finance receipts route exists for member upload", () => {
    const financeRoutes = readFileSync(
      join(repoRoot, "packages/workspaces/denali/src/http/routes-manifest.ts"),
      "utf8"
    );
    assert.match(financeRoutes, /POST.*\/finance\/receipts/);
  });

  it("P6-OR-02 portal member receipt BFF posts file bytes to bookings receipts", () => {
    const bff = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(bff, /\/bookings\//);
    assert.match(bff, /x-receipt-file-name/);
    assert.match(bff, /arrayBuffer/);
  });

  it("P6-OR-03 API dispatches POST+GET /bookings/{id}/receipts", () => {
    const app = readFileSync(join(repoRoot, "apps/api/src/app.ts"), "utf8");
    const routes = readFileSync(
      join(repoRoot, "apps/api/src/bookings/bookings.routes.ts"),
      "utf8"
    );
    assert.match(app, /handlePostBookingReceipt/);
    assert.match(app, /handleGetBookingReceiptStatus/);
    assert.match(routes, /submitMemberReceiptForRegistration/);
    assert.match(routes, /getMemberReceiptStatusForRegistration/);
  });

  it("P6-OR-04 offline receipt chain proven in p6 gate", () => {
    const gate = readFileSync(join(repoRoot, "scripts/p6-denali-product-gate.sh"), "utf8");
    assert.match(gate, /p6-member-receipt-flow\.spec\.ts/);
    assert.match(gate, /p6-vertical-slice-chain\.spec\.ts/);
  });
});
