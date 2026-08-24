/**
 * DP1-H — portal member contract for payment deadline surfaces.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("DP1-H portal payment deadline contract", () => {
  it("S1/S16/S17 MEM-01: registration detail exposes paymentDueAt + countdown markers", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/page.tsx"),
      "utf8"
    );
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx"),
      "utf8"
    );
    assert.match(
      page,
      /paymentDueAt/,
      "DP1-EXPECTED-FAIL: portal registration detail must render paymentDueAt"
    );
    assert.match(page, /data-portal-member-payment-due-at/);
    assert.match(form, /data-portal-member-payment-countdown/);
  });

  it("S4/S10b MEM-03: closed state uses data-closed-reason=payment_expired", () => {
    const form = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx"),
      "utf8"
    );
    assert.match(
      form,
      /payment_expired/,
      "DP1-EXPECTED-FAIL: portal must distinguish payment_expired closed reason"
    );
    assert.match(form, /data-closed-reason=\{?["']payment_expired["']\}?/);
    assert.match(form, /portalMember\.paymentExpiredTitle/);
  });

  it("S16 MEM-BFF: member registration fetch preserves paymentDueAt on reload", () => {
    const fetchModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/fetch-member-registration-by-id.server.ts"),
      "utf8"
    );
    assert.match(
      fetchModule,
      /paymentDueAt/,
      "DP1-EXPECTED-FAIL: member registration BFF must surface paymentDueAt"
    );
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/route.ts"),
      "utf8"
    );
    assert.match(route, /paymentDueAt/);
  });

  it("S15: portal formats UTC dueAt for locale display without recomputing policy hours", () => {
    const formatModule = readFileSync(
      join(repoRoot, "apps/portal/src/me/format-payment-due-at.ts"),
      "utf8"
    );
    assert.match(formatModule, /toLocaleString|Intl\.DateTimeFormat/);
    assert.doesNotMatch(formatModule, /paymentDeadlineHours/);
  });
});
