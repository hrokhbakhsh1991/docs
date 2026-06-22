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

  it("P6-OR-02 portal member receipt BFF posts fileKey to bookings receipts", () => {
    const bff = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(bff, /\/bookings\//);
    assert.match(bff, /fileKey/);
  });

  it("P6-OR-03 API dispatches POST /bookings/{id}/receipts", () => {
    const app = readFileSync(join(repoRoot, "apps/api/src/app.ts"), "utf8");
    const routes = readFileSync(
      join(repoRoot, "apps/api/src/bookings/bookings.routes.ts"),
      "utf8"
    );
    assert.match(app, /handlePostBookingReceipt/);
    assert.match(routes, /submitMemberReceiptForRegistration/);
  });
});
