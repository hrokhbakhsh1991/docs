/**
 * P6-3-N-006 — portal member receipt upload BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-receipt-bff", () => {
  it("MEM-BFF-03 receipt BFF posts JSON fileKey to bookings receipts route", () => {
    const bff = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(bff, /\/bookings\/\$\{encodeURIComponent\(registrationId\)\}\/receipts/);
    assert.match(bff, /fileKey/);
    assert.doesNotMatch(bff, /\/finance\/receipts/);
  });

  it("MEM-BFF-04 member headers forward x-workspace-id from JWT workspace_id", () => {
    const headersModule = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/build-catalog-registration-headers.server.ts"),
      "utf8"
    );
    assert.match(headersModule, /x-workspace-id/);
    assert.match(headersModule, /session\.workspaceId/);
  });
});
