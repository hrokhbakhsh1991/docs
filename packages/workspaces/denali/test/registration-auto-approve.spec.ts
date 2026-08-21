/**
 * Phase 3 — per-tour registrationApproval auto wires host autoApprove after create.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDenaliRegistration } from "../src/http/registration.service.ts";
import type { BookingPublicPort } from "../src/http/ports/public-booking.port.ts";
import type { DenaliTourStorePort, DenaliTourRecord } from "../src/http/ports/tour-store.port.ts";
import { WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID } from "@app-tour/workspace-sdk";

const TOUR_ID = "00000000-0000-4000-8000-000000000413";
const PAST_TOUR_A = "00000000-0000-4000-8000-000000000411";
const PAST_TOUR_B = "00000000-0000-4000-8000-000000000412";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const GUEST_USER_ID = "00000000-0000-4000-8000-000000000199";

function storeWithApproval(mode: "manual" | "auto" | undefined): DenaliTourStorePort {
  return storeWithCanonicalData(
    mode !== undefined ? { pricing: { registrationApproval: mode } } : {}
  );
}

function storeWithManualFlag(requiresManual: boolean): DenaliTourStorePort {
  return storeWithCanonicalData({ requiresManualAdminApproval: requiresManual });
}

function publishedItem(id: string, extra: Record<string, unknown>): DenaliTourRecord {
  return {
    id,
    createdAt: new Date(0).toISOString(),
    canonical: {
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        title: extra.title ?? "Tour",
        publishStatus: "active",
        capacityMax: 12,
        startDateTime: "2026-06-01T08:00:00.000Z",
        ...extra,
      },
    },
  };
}

function storeWithCanonicalData(extra: Record<string, unknown>): DenaliTourStorePort {
  const current = publishedItem(TOUR_ID, extra);
  return {
    async listPage() {
      return { items: [current] };
    },
    async findFirst() {
      return current;
    },
  };
}

function storeWithManualRecentWindow(minRecent: 1 | 2 | 3, pastCount: 1 | 2): DenaliTourStorePort {
  const current = publishedItem(TOUR_ID, {
    title: "Approval Mode Tour",
    requiresManualAdminApproval: true,
    participants: { autoApproveMinRecentTours: minRecent },
  });
  const past = [
    publishedItem(PAST_TOUR_A, {
      title: "Past A",
      startDateTime: "2026-05-15T08:00:00.000Z",
    }),
    publishedItem(PAST_TOUR_B, {
      title: "Past B",
      startDateTime: "2026-05-01T08:00:00.000Z",
    }),
  ].slice(0, pastCount);
  return {
    async listPage() {
      return { items: [current, ...past] };
    },
    async findFirst() {
      return current;
    },
  };
}

function trackingPort(
  approvedTourIds: readonly string[] = [],
  options?: { readonly omitHistoryPort?: boolean }
): {
  readonly port: BookingPublicPort;
  readonly createCalls: number[];
  readonly autoCalls: Array<{ bookingId: string; actorUserId: string }>;
} {
  const createCalls: number[] = [];
  const autoCalls: Array<{ bookingId: string; actorUserId: string }> = [];
  const port: BookingPublicPort = {
    async findDuplicateByTourGuest() {
      return null;
    },
    async findDuplicateByTourGuestLabel() {
      return null;
    },
    async findDuplicateByTourGuestNationalId() {
      return null;
    },
    async findDuplicateByTourGuestPhone() {
      return null;
    },
    async findDuplicateByTourEmail() {
      return null;
    },
    async findOwnedBooking() {
      return null;
    },
    async mergeOwnedRegistrationIntake() {
      return null;
    },
    async reclassifyOwnedOtherToSelf() {
      return null;
    },
    async createPendingBooking() {
      createCalls.push(1);
      return { id: "booking-auto", status: "pending" };
    },
    async autoApprovePublicBooking(input) {
      autoCalls.push({ bookingId: input.bookingId, actorUserId: input.actorUserId });
      return { id: input.bookingId, status: "approved" };
    },
    async sumApprovedPartySizeByTourIds() {
      return {};
    },
    ...(options?.omitHistoryPort === true
      ? {}
      : {
          listApprovedTourIdsByGuest: async () => approvedTourIds,
        }),
  };
  return { port, createCalls, autoCalls };
}

describe("registration-auto-approve — Denali Phase 3", () => {
  it("DN-P3-R01 auto mode calls host autoApprove after create", async () => {
    const { port, createCalls, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Auto Guest" },
        partySize: 1,
      },
      store: storeWithApproval("auto"),
      bookingPort: port,
    });
    assert.equal(createCalls.length, 1);
    assert.equal(autoCalls.length, 1);
    assert.equal(autoCalls[0]?.bookingId, "booking-auto");
    assert.equal(autoCalls[0]?.actorUserId, GUEST_USER_ID);
    assert.equal(created.status, "approved");
  });

  it("DN-P3-R02 manual mode never auto-approves", async () => {
    const { port, createCalls, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Manual Guest" },
        partySize: 1,
      },
      store: storeWithApproval("manual"),
      bookingPort: port,
    });
    assert.equal(createCalls.length, 1);
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R03 missing field defaults to manual", async () => {
    const { port, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Default Guest" },
        partySize: 1,
      },
      store: storeWithApproval(undefined),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R04 checkbox off auto-approves without pricing.registrationApproval", async () => {
    const { port, createCalls, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Checkbox Off Guest" },
        partySize: 1,
      },
      store: storeWithManualFlag(false),
      bookingPort: port,
    });
    assert.equal(createCalls.length, 1);
    assert.equal(autoCalls.length, 1);
    assert.equal(created.status, "approved");
  });

  it("DN-P3-R05 checkbox on stays pending", async () => {
    const { port, autoCalls } = trackingPort();
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Checkbox On Guest" },
        partySize: 1,
      },
      store: storeWithManualFlag(true),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R06 manual + last 2 tours attended auto-approves", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A, PAST_TOUR_B]);
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Regular Guest" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 2),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 1);
    assert.equal(created.status, "approved");
  });

  it("DN-P3-R07 manual + missing one of last 2 stays pending", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A]);
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Partial Guest" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 2),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R08 fewer than N published past tours stays pending", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A, PAST_TOUR_B]);
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Thin Catalog Guest" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 1),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R09 anonymous catalog guest stays pending", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A, PAST_TOUR_B]);
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "Anon Guest" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 2),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R10 registrantTarget=other stays pending", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A, PAST_TOUR_B]);
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        registrantTarget: "other",
        contact: { fullName: "Other Seat", phone: "09121234567" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 2),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });

  it("DN-P3-R11 missing history port stays pending", async () => {
    const { port, autoCalls } = trackingPort([PAST_TOUR_A, PAST_TOUR_B], {
      omitHistoryPort: true,
    });
    const created = await createDenaliRegistration({
      tenantId: TENANT_ID,
      workspaceType: "denali",
      guestUserId: GUEST_USER_ID,
      body: {
        tourId: TOUR_ID,
        contact: { fullName: "No History Port" },
        partySize: 1,
      },
      store: storeWithManualRecentWindow(2, 2),
      bookingPort: port,
    });
    assert.equal(autoCalls.length, 0);
    assert.equal(created.status, "pending");
  });
});
