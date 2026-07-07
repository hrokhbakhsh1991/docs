/**
 * P6-3-N-006 — portal member receipt upload BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-member-receipt-bff", () => {
  it("MEM-BFF-03 POST route returns 401 when Authorization missing", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(route, /headers\.Authorization === undefined/);
    assert.match(route, /AUTH_UNAUTHENTICATED/);
    assert.match(route, /\/bookings\/\$\{encodeURIComponent\(registrationId\)\}\/receipts/);
    assert.match(route, /fileKey/);
    assert.doesNotMatch(route, /\/finance\/receipts/);
  });

  it("MEM-BFF-03b POST route requires multipart file", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(route, /FILE_REQUIRED/);
    assert.match(route, /status: 400/);
  });

  it("MEM-BFF-04 member headers forward x-workspace-id from session", () => {
    const tenantId = "00000000-0000-4000-8000-000000000014";
    const headers = mergeCatalogRegistrationHeaders(tenantId, {
      tenantId,
      userId: "00000000-0000-4000-8000-000000000103",
      workspaceId: "ws-operator-smoke-member",
      role: "member",
    });
    assert.equal(headers["x-workspace-id"], "ws-operator-smoke-member");
    assert.equal(headers["x-user-id"], "00000000-0000-4000-8000-000000000103");
  });
});
