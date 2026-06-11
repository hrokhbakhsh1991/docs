/**
 * Phase 9.5 — manual booking create UI
 * Authority: docs/phase-9/appendices/BOOKINGS-OPS-UX.md · SMK-P9-07
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBookingsCreatePageState } from "../app/(app)/bookings/new/bookings-create-gate";
import {
  buildBookingCreatePayload,
  departureInputFromTour,
  mapToursToCreateOptions,
  validateBookingCreateForm,
} from "../src/features/bookings/bookings-create-logic";
import {
  BOOKINGS_CREATE_TEST_IDS,
  DEFAULT_BOOKING_CREATE_FORM,
} from "../src/features/bookings/bookings-create-types";

const TOURS = mapToursToCreateOptions([
  {
    id: "tour-1",
    title: "North Ridge Trek",
    departureAt: "2026-08-15T00:00:00.000Z",
  },
]);

describe("bookings-create.spec.ts — Phase 9.5 Web", () => {
  it("WEB-9.5-05 manual create form exposes landmarks (SMK-P9-07)", () => {
    assert.equal(BOOKINGS_CREATE_TEST_IDS.page, "operator-bookings-create-page");
    assert.equal(BOOKINGS_CREATE_TEST_IDS.form, "operator-bookings-create-form");
    assert.equal(BOOKINGS_CREATE_TEST_IDS.tourSelect, "operator-bookings-create-tour");
    assert.equal(BOOKINGS_CREATE_TEST_IDS.submitButton, "operator-bookings-create-submit");
    assert.equal(BOOKINGS_CREATE_TEST_IDS.locked, "operator-bookings-create-locked");
  });

  it("WEB-9.5-06 create payload validates and builds pending body", () => {
    const invalid = validateBookingCreateForm(DEFAULT_BOOKING_CREATE_FORM, TOURS);
    assert.equal(invalid.ok, false);

    const form = {
      ...DEFAULT_BOOKING_CREATE_FORM,
      tourId: "tour-1",
      guestLabel: "Jamal Hosseini",
      partySize: "2",
      departureAt: "2026-08-15",
    };
    const valid = validateBookingCreateForm(form, TOURS);
    assert.equal(valid.ok, true);

    const payload = buildBookingCreatePayload(form, TOURS);
    assert.ok(payload !== null);
    assert.equal(payload.tourId, "tour-1");
    assert.equal(payload.tourTitle, "North Ridge Trek");
    assert.equal(payload.guestLabel, "Jamal Hosseini");
    assert.equal(payload.partySize, 2);
    assert.equal(typeof payload.departureAt, "string");
  });

  it("WEB-W6-01 fa messages include bookings.create copy", async () => {
    const { loadAppMessages } = await import("../src/i18n/load-messages");
    const messages = await loadAppMessages("fa");
    const create = messages.bookings.create as { pageTitle: string; submit: string };
    assert.equal(create.pageTitle, "ثبت‌نام جدید");
    assert.equal(create.submit, "ایجاد رزرو در انتظار");
  });

  it("WEB-9.5-07 create gate locks members (CP-9.5-04)", () => {
    assert.equal(departureInputFromTour(TOURS[0]), "2026-08-15");
    const locked = resolveBookingsCreatePageState({
      canManage: false,
      loadingTours: false,
      submitting: false,
      error: null,
    });
    assert.equal(locked.type, "locked");
    const ready = resolveBookingsCreatePageState({
      canManage: true,
      loadingTours: false,
      submitting: false,
      error: null,
    });
    assert.equal(ready.type, "ready");
  });
});
