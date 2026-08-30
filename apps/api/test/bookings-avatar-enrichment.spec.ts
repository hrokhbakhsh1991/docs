/**
 * Bookings ops list — member avatar enrichment (behavioral).
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { buildOperatorAvatarObjectKey } from "@app-tour/workspace-sdk";

import { createRequestListener } from "../src/app";
import type { BookingListItem } from "../src/bookings/bookings.types";
import type { BookingRecord } from "../src/bookings/bookings.types";
import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../src/bookings/create-bookings-repository";
import { enrichBookingListItemsWithMemberAvatars } from "../src/bookings/enrich-booking-list-member-avatars";
import {
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import { operatorAuthHeaders } from "./fixtures/operator-identity-fixture";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const TENANT_ID = OPERATOR_SMOKE.tenantId;
const MEMBER_A = "00000000-0000-4000-8000-000000000201";
const MEMBER_B = "00000000-0000-4000-8000-000000000202";
const MEMBER_C = "00000000-0000-4000-8000-000000000203";
const BOOKING_A = "00000000-0000-4000-8000-000000000401";
const BOOKING_B = "00000000-0000-4000-8000-000000000402";
const BOOKING_C = "00000000-0000-4000-8000-000000000403";
const BOOKING_D = "00000000-0000-4000-8000-000000000404";

type ListRow = BookingListItem & { memberUserId?: string; memberAvatarUrl?: string | null };

function avatarKey(userId: string): string {
  return buildOperatorAvatarObjectKey(TENANT_ID, userId);
}

function baseListItem(id: string, guestLabel: string): BookingListItem {
  return {
    id,
    tourId: OPERATOR_SMOKE.seedTourId,
    tourTitle: "Matrix Trek",
    guestLabel,
    registrantTarget: "other",
    transportKind: null,
    personalCarOccupants: null,
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-01T10:00:00.000Z",
    submittedAt: "2026-08-01T10:00:00.000Z",
  };
}

function baseRecord(id: string, guestLabel: string, submittedByUserId: string): BookingRecord {
  return {
    id,
    tenantId: TENANT_ID,
    tourId: OPERATOR_SMOKE.seedTourId,
    tourTitle: "Matrix Trek",
    guestLabel,
    guestEmail: null,
    guestPhone: null,
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-01T10:00:00.000Z",
    submittedAt: "2026-08-01T10:00:00.000Z",
    submittedByUserId,
    approvedAt: null,
    registrationIntake: { tourCapacityMax: 12 },
  };
}

function seedAvatarMatrix(): void {
  const identity = resetIdentityRepositoryForTests();
  identity.seedUser({ id: OPERATOR_SMOKE.ownerUserId, mobile: OPERATOR_SMOKE.ownerMobile });
  identity.seedUser({ id: MEMBER_A, mobile: "+15550003001" });
  identity.seedUser({ id: MEMBER_B, mobile: "+15550003002" });
  identity.seedUser({ id: MEMBER_C, mobile: "+15550003003" });
  identity.seedMembership({
    userId: OPERATOR_SMOKE.ownerUserId,
    tenantId: TENANT_ID,
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-smoke",
  });
  identity.seedMembership({
    userId: MEMBER_A,
    tenantId: TENANT_ID,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-member-a",
    avatar: {
      storageKey: avatarKey(MEMBER_A),
      contentType: "image/png",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  identity.seedMembership({
    userId: MEMBER_B,
    tenantId: TENANT_ID,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-member-b",
    avatar: {
      storageKey: avatarKey(MEMBER_B),
      contentType: "image/png",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  identity.seedMembership({
    userId: MEMBER_C,
    tenantId: TENANT_ID,
    role: "member",
    status: "ACTIVE",
    sessionVersion: 1,
    workspaceId: "ws-operator-member-c",
  });

  resetBookingsRepositoryForTests();
  const bookings = getBookingsRepository();
  for (const [id, guest, member] of [
    [BOOKING_A, "Guest A", MEMBER_A],
    [BOOKING_B, "Guest B", MEMBER_B],
    [BOOKING_C, "Guest C", MEMBER_C],
    [BOOKING_D, "Guest D", MEMBER_A],
  ] as const) {
    bookings.seedBooking(baseRecord(id, guest, member));
  }
}

function rowById(items: readonly ListRow[], bookingId: string): ListRow {
  const row = items.find((item) => item.id === bookingId);
  assert.ok(row, `missing booking ${bookingId}`);
  return row;
}

describe("bookings-avatar-enrichment.spec.ts — behavioral", () => {
  before(() => {
    seedAvatarMatrix();
  });

  it("BKG-AVT-01 maps memberUserId per booking (A/B/C/D)", async () => {
    const records = [
      baseRecord(BOOKING_A, "Guest A", MEMBER_A),
      baseRecord(BOOKING_B, "Guest B", MEMBER_B),
      baseRecord(BOOKING_C, "Guest C", MEMBER_C),
      baseRecord(BOOKING_D, "Guest D", MEMBER_A),
    ];
    const items = records.map((record) => baseListItem(record.id, record.guestLabel));
    const enriched = await enrichBookingListItemsWithMemberAvatars(TENANT_ID, records, items);

    assert.equal(rowById(enriched, BOOKING_A).memberUserId, MEMBER_A);
    assert.equal(rowById(enriched, BOOKING_B).memberUserId, MEMBER_B);
    assert.equal(rowById(enriched, BOOKING_C).memberUserId, MEMBER_C);
    assert.equal(rowById(enriched, BOOKING_D).memberUserId, MEMBER_A);
  });

  it("BKG-AVT-02 joins by booking id when items order differs from records order", async () => {
    const records = [
      baseRecord(BOOKING_A, "Guest A", MEMBER_A),
      baseRecord(BOOKING_B, "Guest B", MEMBER_B),
      baseRecord(BOOKING_C, "Guest C", MEMBER_C),
      baseRecord(BOOKING_D, "Guest D", MEMBER_A),
    ];
    const items = [...records].reverse().map((record) => baseListItem(record.id, record.guestLabel));
    const enriched = await enrichBookingListItemsWithMemberAvatars(TENANT_ID, records, items);

    assert.equal(rowById(enriched, BOOKING_A).memberUserId, MEMBER_A);
    assert.equal(rowById(enriched, BOOKING_B).memberUserId, MEMBER_B);
    assert.equal(rowById(enriched, BOOKING_C).memberUserId, MEMBER_C);
    assert.equal(rowById(enriched, BOOKING_D).memberUserId, MEMBER_A);
    assert.equal(
      rowById(enriched, BOOKING_A).memberAvatarUrl,
      rowById(enriched, BOOKING_D).memberAvatarUrl
    );
    assert.notEqual(
      rowById(enriched, BOOKING_A).memberUserId,
      rowById(enriched, BOOKING_B).memberUserId
    );
  });

  it("BKG-AVT-03 member without avatar storage gets null memberAvatarUrl", async () => {
    const records = [baseRecord(BOOKING_C, "Guest C", MEMBER_C)];
    const items = [baseListItem(BOOKING_C, "Guest C")];
    const enriched = await enrichBookingListItemsWithMemberAvatars(TENANT_ID, records, items);
    assert.equal(rowById(enriched, BOOKING_C).memberAvatarUrl, null);
  });
});

describe("bookings-avatar-enrichment.spec.ts — HTTP projection", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedAvatarMatrix();
  });

  it("BKG-AVT-04 HTTP list projection preserves memberUserId mapping", async () => {
    const response = await client.requestJson<{ items: ListRow[] }>("GET", "/bookings?view=ops", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.equal(rowById(response.body.items, BOOKING_A).memberUserId, MEMBER_A);
    assert.equal(rowById(response.body.items, BOOKING_B).memberUserId, MEMBER_B);
    assert.equal(rowById(response.body.items, BOOKING_C).memberUserId, MEMBER_C);
    assert.equal(rowById(response.body.items, BOOKING_D).memberUserId, MEMBER_A);
  });
});
