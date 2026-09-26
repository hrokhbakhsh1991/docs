import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const statusCard = readFileSync(
  new URL("../app/me/registrations/[id]/member-registration-status-card.tsx", import.meta.url),
  "utf8"
);
const messages = JSON.parse(
  readFileSync(new URL("../messages/fa/portalMember.json", import.meta.url), "utf8")
) as {
  detail?: Record<string, string>;
};

describe("BUG-STG-RECEIPT-STATUS-LABEL-MIXED", () => {
  it("keeps registration and receipt labels separate", () => {
    assert.match(statusCard, /data-portal-member-detail-status-badge/);
    assert.match(statusCard, /registrationStatusBadge/);
    assert.match(statusCard, /data-portal-member-detail-receipt-status-badge/);
    assert.match(statusCard, /receiptStatusLabelKey\(receiptStatus\)/);
    assert.equal(messages.detail?.registrationStatusBadge, "ثبت‌نام: {status}");
    assert.match(messages.detail?.receiptStatusRejected ?? "", /^رسید:/);
    assert.match(messages.detail?.receiptStatusPending ?? "", /^رسید:/);
    assert.match(messages.detail?.receiptStatusPaid ?? "", /^رسید:/);
  });
});
