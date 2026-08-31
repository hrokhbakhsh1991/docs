import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  formatMemberMinorAmount,
  formatLocalizedNumber,
  normalizeNumericInputValue,
  toLocalizedDigits,
} from "../src/i18n/format-localized-digits";
import { formatPaymentDueAtForMemberLocale } from "../src/me/format-payment-due-at";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("portal-l10n-sweep", () => {
  it("PTL-L10N-10 nationalId uses localized numeric input and ASCII state", () => {
    const form = readRepo("apps/portal/app/me/profile/member-profile-form.tsx");
    assert.match(form, /fieldId === "nationalId"/);
    assert.match(form, /PrimitiveLocalizedNumericInput/);
    assert.match(form, /mode="digits"/);
    assert.match(form, /maxLength=\{10\}/);
    assert.match(form, /toLocalizedDigits\(profile\.fields\[fieldId\]!/);

    assert.equal(normalizeNumericInputValue("۱۲۳۴۵۶۷۸۹۰", "digits"), "1234567890");
    assert.equal(toLocalizedDigits("1234567890", "fa"), "۱۲۳۴۵۶۷۸۹۰");
    assert.equal(toLocalizedDigits("1234567890", "en"), "1234567890");
  });

  it("PTL-L10N-11 receipt amounts format fa/en from minor strings", () => {
    const form = readRepo("apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx");
    assert.match(form, /formatMemberMinorAmount/);
    assert.doesNotMatch(form, /toLocaleString\("fa-IR"\)/);

    assert.equal(formatMemberMinorAmount("1500000", "IRR", "fa"), "۱٬۵۰۰٬۰۰۰ ریال");
    assert.equal(formatMemberMinorAmount("1500000", "IRR", "en"), "1,500,000 IRR");
  });

  it("PTL-L10N-12 payment due respects member locale", () => {
    const page = readRepo("apps/portal/app/me/registrations/[id]/page.tsx");
    const formatModule = readRepo("apps/portal/src/me/format-payment-due-at.ts");
    assert.match(page, /formatPaymentDueAtForMemberLocale\(row\.paymentDueAt, locale\)/);
    assert.match(formatModule, /locale: AppLocale/);

    const iso = "2026-08-31T14:30:00.000Z";
    const faLabel = formatPaymentDueAtForMemberLocale(iso, "fa");
    const enLabel = formatPaymentDueAtForMemberLocale(iso, "en");
    assert.notEqual(faLabel, enLabel);
    assert.match(faLabel, /[۰-۹]/);
    assert.doesNotMatch(enLabel, /[۰-۹]/);
    assert.equal(iso, iso);
  });

  it("PTL-L10N-13 cancellation refund uses formatted amount only", () => {
    const panel = readRepo("apps/portal/app/me/registrations/[id]/member-cancellation-panel.tsx");
    const faMessages = readRepo("apps/portal/messages/fa/portalMember.json");
    assert.match(panel, /formatMemberMinorAmount\(/);
    assert.match(faMessages, /"cancellation":/);
    assert.match(faMessages, /"refundEligible": "مبلغ قابل استرداد: \{amount\}"/);

    assert.equal(
      formatMemberMinorAmount("1500000", "IRR", "fa"),
      "۱٬۵۰۰٬۰۰۰ ریال"
    );
  });

  it("PTL-L10N-14 registration guest limit uses localizedUserFacingCount", () => {
    const steps = readRepo(
      "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
    );
    assert.match(steps, /guestLimitReached[\s\S]*localizedUserFacingCount\(DENALI_MAX_OTHER_GUESTS, locale\)/);
    assert.equal(formatLocalizedNumber(10, "fa", { useGrouping: false }), "۱۰");
    assert.equal(formatLocalizedNumber(10, "en", { useGrouping: false }), "10");
  });

  it("PTL-L10N-15 registration partial success localizes ok/total counts", () => {
    const steps = readRepo(
      "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
    );
    assert.match(steps, /partialSuccess[\s\S]*localizedUserFacingCount\(/);
    assert.equal(formatLocalizedNumber(8, "fa", { useGrouping: false }), "۸");
    assert.equal(formatLocalizedNumber(10, "fa", { useGrouping: false }), "۱۰");
  });
});
