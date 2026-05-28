import fc from "fast-check";
import { DENALI_TOUR_KIND_VALUES, type DenaliTourKind } from "@repo/types";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { sanitizeDenaliFormPatch } from "../denaliFormSanitize";

/** Partial wizard patch used as draft / preset input to {@link sanitizeDenaliFormPatch}. */
type DenaliWizardState = Partial<DenaliCreateTourWizardForm>;

const tourKindArb = fc.constantFrom(...DENALI_TOUR_KIND_VALUES) as fc.Arbitrary<DenaliTourKind>;

const ISO_MIN_MS = Date.parse("2020-01-01T00:00:00.000Z");
const ISO_MAX_MS = Date.parse("2030-12-31T23:59:59.999Z");

const isoDateTimeArb = fc
  .integer({ min: ISO_MIN_MS, max: ISO_MAX_MS })
  .map((ms) => new Date(ms).toISOString());

/** Start/end pair with Start ≤ End (when both are set). */
const tourDateFieldsArb = fc
  .tuple(isoDateTimeArb, isoDateTimeArb)
  .map(([a, b]) => {
    const startMs = Date.parse(a);
    const endMs = Date.parse(b);
    const start = startMs <= endMs ? a : b;
    const end = startMs <= endMs ? b : a;
    return { startDateTime: start, endDateTime: end };
  });

const gearItemArb = fc.record({
  id: fc.uuid(),
  isRequired: fc.boolean(),
});

/** `pricingPayment` slice (user-facing “pricing data” on the wizard form). */
const pricingPaymentArb = fc.record({
  requiresPayment: fc.boolean(),
  basePricePerPerson: fc.option(fc.nat({ max: 500_000 }), { nil: undefined }),
  paymentMode: fc.constant("offline_receipt" as const),
  includesTourInsurance: fc.boolean(),
});

const arbitraryWizardState: fc.Arbitrary<DenaliWizardState> = tourDateFieldsArb.chain(
  (dates) =>
    fc.record({
      basicInfo: fc.record({
        title: fc.string({ minLength: 0, maxLength: 80 }),
        tourType: tourKindArb,
        startDateTime: fc.constant(dates.startDateTime),
        endDateTime: fc.constant(dates.endDateTime),
        capacityMax: fc.option(fc.nat({ max: 200 }), { nil: undefined }),
      }),
      participantRequirements: fc.record({
        gearItems: fc.array(gearItemArb, { maxLength: 12 }),
      }),
      pricingPayment: pricingPaymentArb,
    }),
);

function hasConflictingTourDates(patch: Partial<DenaliCreateTourWizardForm>): boolean {
  const start = patch.basicInfo?.startDateTime?.trim();
  const end = patch.basicInfo?.endDateTime?.trim();
  if (!start || !end) {
    return false;
  }
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return false;
  }
  return startMs > endMs;
}

describe("denali wizard logic (property)", () => {
  it("sanitizeDenaliFormPatch always returns a patch object", () => {
    fc.assert(
      fc.property(arbitraryWizardState, (state) => {
        const result = sanitizeDenaliFormPatch(state);
        return result !== null && typeof result === "object";
      }),
      { numRuns: 150 },
    );
  });

  it("sanitized form never contains conflicting tour dates (start > end)", () => {
    fc.assert(
      fc.property(arbitraryWizardState, (state) => {
        const sanitized = sanitizeDenaliFormPatch(state);
        return !hasConflictingTourDates(sanitized);
      }),
      { numRuns: 150 },
    );
  });

  it("sanitize strips legacy derived keys but keeps tourType and gearItems", () => {
    fc.assert(
      fc.property(arbitraryWizardState, (state) => {
        const withLegacy: DenaliWizardState = {
          ...state,
          basicInfo: {
            ...state.basicInfo,
            isMultiDay: true,
          } as DenaliWizardState["basicInfo"],
          programNature: {
            difficultyType: "physical",
            mainTourThemeId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
          } as DenaliWizardState["programNature"],
          pricingPayment: {
            ...state.pricingPayment,
            includesTransportInPrice: true,
          } as DenaliWizardState["pricingPayment"],
        };

        const sanitized = sanitizeDenaliFormPatch(withLegacy);
        const basic = sanitized.basicInfo as Record<string, unknown> | undefined;
        const program = sanitized.programNature as Record<string, unknown> | undefined;
        const pricing = sanitized.pricingPayment as Record<string, unknown> | undefined;

        if (state.basicInfo?.tourType != null && basic != null) {
          if (basic.tourType !== state.basicInfo.tourType) return false;
        }
        if (basic?.isMultiDay !== undefined) return false;
        if (program?.difficultyType !== undefined) return false;
        if (pricing?.includesTransportInPrice !== undefined) return false;

        const gearIn = state.participantRequirements?.gearItems ?? [];
        const gearOut = sanitized.participantRequirements?.gearItems ?? [];
        if (gearOut.length !== gearIn.length) return false;

        return true;
      }),
      { numRuns: 100 },
    );
  });
});
