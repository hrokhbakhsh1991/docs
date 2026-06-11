/**
 * Phase 9.3 — operator tour register (R4)
 * Authority: docs/phase-9/appendices/TOURS-REGISTER-UX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTourRegisterGateState } from "../app/(app)/tours/[id]/register/tour-register-gate";
import { buildBookingCreatePayload } from "../src/features/bookings/bookings-create-logic";
import { TOUR_EDIT_TEST_IDS } from "../src/features/tours/operator-tour-detail-types";
import {
  buildTourRegisterSuccessRedirect,
  initRegisterFormFromTour,
  mapTourDetailToCreateOption,
} from "../src/features/tours/tour-register-logic";
import { TOUR_REGISTER_TEST_IDS } from "../src/features/tours/tour-register-types";

const TOUR_ID = "00000000-0000-4000-8000-000000000099";

describe("tours-register.spec.ts — Phase 9.3 Web", () => {
  it("WEB-9.3-R01 register page exposes landmarks (CP-9.3-R01)", () => {
    assert.equal(TOUR_REGISTER_TEST_IDS.page, "operator-tour-register-page");
    assert.equal(TOUR_REGISTER_TEST_IDS.form, "operator-tour-register-form");
    assert.equal(TOUR_REGISTER_TEST_IDS.submitButton, "operator-tour-register-submit");
    assert.equal(TOUR_REGISTER_TEST_IDS.locked, "operator-tour-register-locked");
  });

  it("WEB-9.3-R02 payload uses route tourId (CP-9.3-R02)", () => {
    const detail = mapTourDetailToCreateOption({
      id: TOUR_ID,
      tenantId: "00000000-0000-4000-8000-000000000014",
      rowVersion: 1,
      canonical: { data: {} },
      projection: {
        id: TOUR_ID,
        tenantId: "00000000-0000-4000-8000-000000000014",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        rowVersion: 1,
        title: "Alpine Trek",
        shortDescription: null,
        listStatus: "active",
        uiStatus: "active",
        priceAmount: null,
        priceCurrency: null,
        totalCapacity: 12,
        acceptedCount: 0,
        category: null,
        coverImageUrl: null,
        departureAt: "2026-09-01T00:00:00.000Z",
      },
    });
    assert.equal(detail.id, TOUR_ID);
    assert.equal(detail.title, "Alpine Trek");

    const form = {
      ...initRegisterFormFromTour(detail),
      guestLabel: "Guest One",
      partySize: "1",
      departureAt: "2026-09-01",
    };
    const payload = buildBookingCreatePayload(form, [detail]);
    assert.ok(payload !== null);
    assert.equal(payload.tourId, TOUR_ID);
    assert.equal(payload.tourTitle, "Alpine Trek");
    assert.equal(
      buildTourRegisterSuccessRedirect(TOUR_ID),
      `/bookings?status=pending&tourId=${TOUR_ID}`
    );
  });

  it("WEB-9.3-R03 register gate locks members (CP-9.3-R03)", () => {
    const locked = resolveTourRegisterGateState({
      canManage: false,
      loadingTour: false,
      submitting: false,
      error: null,
      tourNotFound: false,
    });
    assert.equal(locked.type, "locked");
    const ready = resolveTourRegisterGateState({
      canManage: true,
      loadingTour: false,
      submitting: false,
      error: null,
      tourNotFound: false,
    });
    assert.equal(ready.type, "ready");
    assert.equal(TOUR_EDIT_TEST_IDS.register, "operator-tour-edit-register");
  });
});
