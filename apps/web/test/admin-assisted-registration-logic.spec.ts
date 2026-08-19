import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAdminAssistedRegistrationPayload,
  createDefaultAdminAssistedRegistrationForm,
  extractWorkspaceAdminRegistrationRequirements,
  resolveTransportChoices,
  stepHasVisibleRequirements,
  validateAdminAssistedRegistrationStep,
} from "../src/features/bookings/admin-assisted-registration-logic";
import type { OperatorTourDetailResponse } from "../src/features/tours/operator-tour-detail-types";

const TOUR_DETAIL: OperatorTourDetailResponse = {
  id: "tour-1",
  tenantId: "tenant-1",
  rowVersion: 1,
  canonical: {
    data: {
      title: "Damavand One Day",
      startDateTime: "2026-08-20T04:00:00.000Z",
      capacityMax: 12,
      pricing: {
        basePricePerPerson: 1250000,
        registrationApproval: "auto",
      },
      transport: {
        mode: "shared_cars",
        allowPersonalCar: true,
        dongAmount: 250000,
      },
      participantRequirements: {
        nationalIdRequired: true,
        fatherNameRequired: true,
        birthDateRequired: false,
      },
    },
  },
  projection: {
    id: "tour-1",
    title: "Damavand One Day",
    uiStatus: "published",
    departureAt: "2026-08-20T04:00:00.000Z",
    acceptedCount: 1,
    pendingCount: 0,
    totalCapacity: 12,
  },
};

describe("admin-assisted-registration-logic", () => {
  it("extracts registration requirements from the tour canonical", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements(TOUR_DETAIL);

    assert.equal(requirements.title, "Damavand One Day");
    assert.equal(requirements.registrationApprovalMode, "auto");
    assert.equal(requirements.transport.mode, "shared_cars");
    assert.equal(requirements.transport.dongAmount, 250000);
    assert.equal(requirements.participantRequirements.nationalIdRequired, true);
    assert.equal(stepHasVisibleRequirements(requirements), true);
    assert.deepEqual(resolveTransportChoices(requirements), [
      "personal_car",
      "no_car_dong",
      "no_car_acquaintance",
    ]);
  });

  it("defaults the form to the workspace's preferred approval and transport flow", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements(TOUR_DETAIL);
    const form = createDefaultAdminAssistedRegistrationForm(requirements);

    assert.equal(form.approveNow, true);
    assert.equal(form.transportKind, "personal_car");
  });

  it("treats wizard checkbox off as auto when pricing.registrationApproval is absent", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements({
      ...TOUR_DETAIL,
      canonical: {
        data: {
          ...TOUR_DETAIL.canonical.data,
          pricing: { basePricePerPerson: 1250000 },
          requiresManualAdminApproval: false,
        },
      },
    });
    assert.equal(requirements.registrationApprovalMode, "auto");
    assert.equal(createDefaultAdminAssistedRegistrationForm(requirements).approveNow, true);
  });

  it("treats wizard checkbox on as manual when pricing.registrationApproval is absent", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements({
      ...TOUR_DETAIL,
      canonical: {
        data: {
          ...TOUR_DETAIL.canonical.data,
          pricing: { basePricePerPerson: 1250000 },
          requiresManualAdminApproval: true,
        },
      },
    });
    assert.equal(requirements.registrationApprovalMode, "manual");
    assert.equal(createDefaultAdminAssistedRegistrationForm(requirements).approveNow, false);
  });

  it("validates step requirements before moving forward", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements(TOUR_DETAIL);
    const invalidIdentity = validateAdminAssistedRegistrationStep({
      step: "identity",
      requirements,
      form: {
        ...createDefaultAdminAssistedRegistrationForm(requirements),
        registrantMode: "guest",
      },
    });

    assert.equal(invalidIdentity.ok, false);
    assert.equal(invalidIdentity.field, "guestLabel");

    const invalidRequirements = validateAdminAssistedRegistrationStep({
      step: "requirements",
      requirements,
      form: {
        ...createDefaultAdminAssistedRegistrationForm(requirements),
        registrantMode: "guest",
        guestLabel: "Guest",
        guestPhone: "09123456789",
        nationalId: "123",
        fatherName: "",
      },
    });

    assert.equal(invalidRequirements.ok, false);
    assert.equal(invalidRequirements.field, "nationalId");
  });

  it("builds a booking payload that keeps operator flow aligned with backend contracts", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements(TOUR_DETAIL);
    const payload = buildAdminAssistedRegistrationPayload({
      tourId: "tour-1",
      requirements,
      form: {
        ...createDefaultAdminAssistedRegistrationForm(requirements),
        registrantMode: "guest",
        guestLabel: "Ali Rezaei",
        guestPhone: "09123456789",
        guestEmail: "ali@example.com",
        partySize: "2",
        nationalId: "1234567890",
        fatherName: "Reza",
        paymentStatus: "unpaid",
        transportKind: "personal_car",
        personalCarOccupants: "3",
        approveNow: true,
      },
    });

    assert.equal(payload.tourTitle, "Damavand One Day");
    assert.equal(payload.partySize, 2);
    assert.equal(payload.paymentStatus, "unpaid");
    assert.deepEqual(payload.registrationIntake, {
      registrantTarget: "other",
      transport: { kind: "personal_car", personalCarOccupants: 3 },
      nationalId: "1234567890",
      tourCapacityMax: 12,
    });
  });

  it("builds a member-owned payload when the admin selects an existing workspace member", () => {
    const requirements = extractWorkspaceAdminRegistrationRequirements(TOUR_DETAIL);
    const payload = buildAdminAssistedRegistrationPayload({
      tourId: "tour-1",
      requirements,
      form: {
        ...createDefaultAdminAssistedRegistrationForm(requirements),
        registrantMode: "member",
        memberUserId: "user-42",
        memberDisplayName: "Member Guest",
        guestPhone: "09125550000",
        guestEmail: "member@example.com",
        partySize: "1",
        transportKind: "no_car_dong",
      },
    });

    assert.equal(payload.memberUserId, "user-42");
    assert.equal(payload.guestLabel, "Member Guest");
    assert.equal(payload.registrationIntake.registrantTarget, "self");
  });
});
