import assert from "node:assert/strict";
import test from "node:test";

import { resolveTourSuggestedPrepaymentMinor } from "@/features/tours/resolve-tour-suggested-prepayment-minor";

test("workspace commercial capability preserves suggested prepayment", () => {
  const policy = {
    resolveSuggestedPrepaymentMinor: (input: {
      readonly tourCanonicalData: unknown;
      readonly invoiceTotalMinor: string;
      readonly balanceDueMinor: string;
    }) => {
      const percent = (input.tourCanonicalData as { pricing: { prepaymentPercent: number } })
        .pricing.prepaymentPercent;
      return ((BigInt(input.invoiceTotalMinor) * BigInt(percent)) / BigInt(100)).toString();
    },
  };
  assert.equal(
    resolveTourSuggestedPrepaymentMinor({
      tourCanonicalData: {
        pricing: { prepaymentEnabled: true, prepaymentPercent: 30 },
      },
      invoiceTotalMinor: "1000",
      balanceDueMinor: "500",
      commercialPolicy: policy,
    }),
    "300"
  );
});

test("missing workspace policy is neutral", () => {
  assert.equal(
    resolveTourSuggestedPrepaymentMinor({
      tourCanonicalData: {
        pricing: { prepaymentEnabled: true, prepaymentPercent: 30 },
      },
      invoiceTotalMinor: "1000",
      balanceDueMinor: "500",
    }),
    null
  );
});

test("future workspace can provide prepayment semantics through capability data", () => {
  const policy = {
    resolveSuggestedPrepaymentMinor: () => "125",
  };
  assert.equal(
    resolveTourSuggestedPrepaymentMinor({
      tourCanonicalData: { different: { prepayment: true } },
      invoiceTotalMinor: "1000",
      balanceDueMinor: "500",
      commercialPolicy: policy,
    }),
    "125"
  );
});
