/**
 * Discount MVP 2A — membership discount gate UI + persistence (GATE-01..05).
 * Authority: docs/workspaces/denali/commercial-quote-snapshot.mdoc (DEC-CQ-011)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft.ts";
import { resolveDenaliAllowMembershipDiscount } from "../src/finance/resolve-denali-allow-membership-discount.ts";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema.ts";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/rules/generated/denaliCanonicalPathMap.generated.ts";
import { tourWizardDraftToCanonicalDocument } from "../src/ui/logic/denali-wizard-canonical.ts";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");
const EN_MESSAGES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../messages/en/wizard.json"), "utf8")
) as { fields: { pricing: Record<string, string> } };

const PRICING_ROOTS = ["pricing", "category"] as const;

function draftWithGate(enabled: boolean | undefined) {
  let draft = emptyDenaliTourWizardDraft();
  draft = setCanonicalStringValue(draft, "pricing.requiresPayment", "true");
  if (enabled === undefined) {
    return draft;
  }
  return setCanonicalStringValue(
    draft,
    "pricing.allowMembershipDiscount",
    enabled ? "true" : "false"
  );
}

function canonicalFromDraft(draft: ReturnType<typeof emptyDenaliTourWizardDraft>) {
  return tourWizardDraftToCanonicalDocument(draft, PRICING_ROOTS);
}

describe("allow-membership-discount-gate.spec.ts — Discount MVP 2A", () => {
  it("GATE-01: create tour with true persists true", () => {
    const draft = draftWithGate(true);
    assert.equal(getCanonicalStringValue(draft, "pricing.allowMembershipDiscount"), "true");
    const canonical = canonicalFromDraft(draft);
    assert.equal(
      (canonical.data as { pricing?: { allowMembershipDiscount?: unknown } }).pricing
        ?.allowMembershipDiscount,
      "true"
    );
    assert.equal(resolveDenaliAllowMembershipDiscount(canonical), true);
  });

  it("GATE-02: create tour without field defaults false", () => {
    const defaults = buildDenaliTourCreateDefaultValues();
    assert.equal(defaults.pricingPayment.allowMembershipDiscount, false);

    const draft = draftWithGate(undefined);
    assert.equal(getCanonicalStringValue(draft, "pricing.allowMembershipDiscount"), "");
    assert.equal(resolveDenaliAllowMembershipDiscount(canonicalFromDraft(draft)), false);
  });

  it("GATE-03: edit tour toggles value", () => {
    let draft = draftWithGate(false);
    assert.equal(resolveDenaliAllowMembershipDiscount(canonicalFromDraft(draft)), false);

    draft = setCanonicalStringValue(draft, "pricing.allowMembershipDiscount", "true");
    assert.equal(resolveDenaliAllowMembershipDiscount(canonicalFromDraft(draft)), true);

    draft = setCanonicalStringValue(draft, "pricing.allowMembershipDiscount", "false");
    assert.equal(resolveDenaliAllowMembershipDiscount(canonicalFromDraft(draft)), false);
  });

  it("GATE-04: Finance-facing gate reader path is wired", () => {
    const enabled = canonicalFromDraft(draftWithGate(true));
    const disabled = canonicalFromDraft(draftWithGate(false));
    assert.equal(resolveDenaliAllowMembershipDiscount(enabled), true);
    assert.equal(resolveDenaliAllowMembershipDiscount(disabled), false);
    assert.equal(
      DENALI_CANONICAL_TO_FORM_PATH_MAP["pricing.allowMembershipDiscount"],
      "pricingPayment.allowMembershipDiscount"
    );
  });

  it("GATE-05: existing tours without field do not enable discount", () => {
    const legacy = {
      data: {
        pricing: {
          requiresPayment: true,
          basePricePerPerson: 2_500_000,
          paymentMode: "offline_receipt",
        },
      },
    };
    assert.equal(resolveDenaliAllowMembershipDiscount(legacy), false);
  });

  it("UI control + messages exist for pricing.allowMembershipDiscount", () => {
    const pricing = readFileSync(
      join(SRC_ROOT, "ui/fields/denali-pricing-payment-field.tsx"),
      "utf8"
    );
    assert.match(pricing, /pricing\.allowMembershipDiscount/);
    assert.match(pricing, /denali-pricing-allow-membership-discount/);
    assert.match(pricing, /requiresPayment/);
    assert.equal(
      EN_MESSAGES.fields.pricing.allowMembershipDiscount,
      "Allow membership discount on this tour"
    );
  });
});
