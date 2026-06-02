import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeDenaliFormPatch } from "./denaliFormSanitize";

test("sanitizeDenaliFormPatch strips legacy derived keys", () => {
  const patch = sanitizeDenaliFormPatch({
    basicInfo: {
      title: "abcdefghijabcdefghij",
      tourType: "mountain_day",
      destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      startDateTime: "2026-06-01T08:00:00.000Z",
      capacityMax: 10,
      isMultiDay: true,
    } as never,
    programNature: {
      mainTourThemeId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      shortDescription: "x",
      difficultyType: "physical",
    } as never,
    pricingPayment: {
      requiresPayment: true,
      paymentMode: "offline_receipt",
      includesTransportInPrice: true,
    } as never,
  });

  assert.equal((patch.basicInfo as { isMultiDay?: boolean }).isMultiDay, undefined);
  assert.equal((patch.programNature as { difficultyType?: string }).difficultyType, undefined);
  assert.equal(
    (patch.pricingPayment as { includesTransportInPrice?: boolean }).includesTransportInPrice,
    undefined,
  );
  assert.equal(patch.basicInfo?.tourType, "mountain_day");
  assert.equal((patch.programNature as { mainTourThemeId?: string }).mainTourThemeId, undefined);
});
