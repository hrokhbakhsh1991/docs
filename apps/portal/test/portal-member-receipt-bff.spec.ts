/**
 * P6-3-N-006 — portal member receipt upload BFF
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { mergeCatalogRegistrationHeaders } from "../src/catalog/build-catalog-registration-headers.server";
import { parseMemberReceiptPanel } from "../src/me/member-receipt-status";

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
    assert.match(route, /x-receipt-file-name/);
    assert.match(route, /Content-Type/);
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

  it("MEM-BFF-03c GET route proxies receipt status upstream", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/receipt/route.ts"),
      "utf8"
    );
    assert.match(route, /export async function GET/);
    assert.match(route, /RECEIPT_STATUS_FAILED/);
    assert.match(route, /parseMemberReceiptPanel/);
    assert.match(route, /\.\.\.panel/);
  });

  it("MEM-BFF-03d shared receipt status type is client-safe", () => {
    const shared = readFileSync(
      join(repoRoot, "apps/portal/src/me/member-receipt-status.ts"),
      "utf8"
    );
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx"),
      "utf8"
    );
    assert.match(shared, /export type MemberReceiptStatus/);
    assert.match(shared, /parseMemberReceiptPanel/);
    assert.match(shared, /waived/);
    assert.match(form, /@\/me\/member-receipt-status/);
    assert.match(form, /createObjectURL/);
    assert.match(form, /data-portal-member-receipt-preview/);
    assert.doesNotMatch(form, /parseMemberReceiptPanel/);
    assert.doesNotMatch(form, /catalogDue\?\.currency\s*\?\?\s*["']IRR["']/);
    assert.doesNotMatch(form, /dueCurrency\s*=.*["']IRR["']/);
  });

  it("MEM-BFF-03e parseMemberReceiptPanel maps remaining and waived", () => {
    const panel = parseMemberReceiptPanel({
      ok: true,
      status: "waived",
      remainingMinor: "0",
      currency: "IRR",
      previewUrl: "https://example.test/proof.jpg",
      previewKind: "image",
    });
    assert.equal(panel.status, "waived");
    assert.equal(panel.remainingMinor, "0");
    assert.equal(panel.currency, "IRR");
    assert.equal(panel.previewKind, "image");
    assert.equal(parseMemberReceiptPanel({ status: "bogus" }).status, "none");
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
