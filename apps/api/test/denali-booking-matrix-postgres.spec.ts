/**
 * Denali B-01..B-06/B-08 registration and B-09/B-10/B-12 roster persistence matrix.
 *
 * Each row owns a unique tenant-scoped tour and guest. B-07 is covered by the
 * PostgreSQL member smoke receipt-to-finance journey and is deliberately not
 * repeated here.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import ExcelJS from "exceljs";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import {
  getBookingsRepository,
  resetBookingsRepositorySingletonForTests,
} from "../src/bookings/create-bookings-repository";
import { PrismaBookingsRepository } from "../src/bookings/prisma-bookings.repository";
import { resetBookingsServiceCompositionForTests } from "../src/bookings/create-bookings-service";
import { resetLazyFinanceServiceForTests } from "../src/boot/lazy-finance-service";
import { resetLazyRouteHandlersForTests } from "../src/boot/lazy-route-handlers";
import { resetLazyWorkspaceFinanceHandlersForTests } from "../src/boot/lazy-workspace-finance-handlers";
import { disconnectPrisma } from "../src/db/prisma";
import {
  buildDenaliBookingScenarioTour,
  DENALI_BOOKING_PAID_AUTO_TOUR_ID,
} from "../src/fixtures/operator-smoke-published-tour.fixture";
import { integrationTenantId } from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());
const postgresSkip = hasDatabase
  ? false
  : "DENALI_BOOKING_MATRIX_POSTGRES_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN";

type BookingState = "pending" | "approved" | "rejected" | "cancelled";
type Transition = "approve" | "reject" | "cancel";

type Scenario = {
  readonly id: string;
  readonly collection: "free" | "offline";
  readonly approval: "manual" | "auto";
  readonly expectedInitial: BookingState;
  readonly transition?: Transition;
  readonly expectedFinal?: BookingState;
  readonly expectedInitialPaymentStatus: "paid" | "unpaid";
  readonly expectedPaymentStatus: "paid" | "unpaid";
  readonly expectsPaymentHold?: boolean;
};

const scenarios: readonly Scenario[] = [
  {
    id: "B-01 free/manual approval",
    collection: "free",
    approval: "manual",
    expectedInitial: "pending",
    transition: "approve",
    expectedFinal: "approved",
    expectedInitialPaymentStatus: "unpaid",
    expectedPaymentStatus: "paid",
  },
  {
    id: "B-02 free/auto",
    collection: "free",
    approval: "auto",
    expectedInitial: "approved",
    expectedInitialPaymentStatus: "paid",
    expectedPaymentStatus: "paid",
  },
  {
    id: "B-03 paid/manual pending",
    collection: "offline",
    approval: "manual",
    expectedInitial: "pending",
    expectedInitialPaymentStatus: "unpaid",
    expectedPaymentStatus: "unpaid",
  },
  {
    id: "B-04 paid/auto payment hold",
    collection: "offline",
    approval: "auto",
    expectedInitial: "approved",
    expectedInitialPaymentStatus: "unpaid",
    expectedPaymentStatus: "unpaid",
    expectsPaymentHold: true,
  },
  {
    id: "B-05 paid/manual approval",
    collection: "offline",
    approval: "manual",
    expectedInitial: "pending",
    transition: "approve",
    expectedFinal: "approved",
    expectedInitialPaymentStatus: "unpaid",
    expectedPaymentStatus: "unpaid",
  },
  {
    id: "B-06 paid/manual rejection",
    collection: "offline",
    approval: "manual",
    expectedInitial: "pending",
    transition: "reject",
    expectedFinal: "rejected",
    expectedInitialPaymentStatus: "unpaid",
    expectedPaymentStatus: "unpaid",
  },
  {
    id: "B-08 free/auto cancellation",
    collection: "free",
    approval: "auto",
    expectedInitial: "approved",
    transition: "cancel",
    expectedFinal: "cancelled",
    expectedInitialPaymentStatus: "paid",
    expectedPaymentStatus: "paid",
  },
];

function requestHeaders(input: {
  readonly tenantId: string;
  readonly userId?: string;
  readonly role?: "owner" | "member";
}): Record<string, string> {
  return {
    "x-tenant-id": input.tenantId,
    "x-authenticated-tenant-id": input.tenantId,
    ...(input.userId === undefined ? {} : { "x-user-id": input.userId }),
    ...(input.role === undefined ? {} : { "x-actor-role": input.role }),
    ...(input.role === undefined ? {} : { "x-membership-status": "ACTIVE" }),
    ...(input.role === undefined ? {} : { "x-workspace-id": "ws-denali-booking-matrix" }),
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId?: string;
    readonly role?: "owner" | "member";
    readonly body?: unknown;
  }
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("DENALI_BOOKING_MATRIX_NO_LISTEN_ADDRESS"));
        return;
      }
      const payload = input.body === undefined ? undefined : JSON.stringify(input.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: {
            ...(payload === undefined
              ? {}
              : {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }),
            ...requestHeaders(input),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
            });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

async function requestBytes(
  listener: ReturnType<typeof createRequestListener>,
  input: {
    readonly method: string;
    readonly path: string;
    readonly tenantId: string;
    readonly userId?: string;
    readonly role?: "owner" | "member";
  }
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("DENALI_BOOKING_MATRIX_NO_LISTEN_ADDRESS"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: input.path,
          method: input.method,
          headers: requestHeaders(input),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: Buffer.concat(chunks),
            });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.end();
    });
  });
}

describe(
  "Denali booking matrix PostgreSQL persistence and HTTP reload",
  { concurrency: false, skip: postgresSkip },
  () => {
    const tenantId = integrationTenantId();
    const discountMembershipTenantId = randomUUID();
    const ownerId = randomUUID();
    const tourIds: string[] = [];
    const memberUserIds: string[] = [];
    let admin: PrismaClient | undefined;
    let listener: ReturnType<typeof createRequestListener>;

    before(async () => {
      assert.equal(
        process.env.STORAGE_DRIVER?.trim().toLowerCase(),
        "prisma",
        "DENALI_BOOKING_MATRIX_POSTGRES_REQUIRES_PRISMA_STORAGE"
      );
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      process.env.PROJECTION_AUTO_RECONCILE_ENABLED = "false";
      process.env.PAYMENT_HOLD_ENABLED = "true";
      process.env.TENANT_RATE_LIMIT_ENABLED = "false";

      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetLazyWorkspaceFinanceHandlersForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();

      admin = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
      });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `denali-bm-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.tenant.create({
        data: {
          id: discountMembershipTenantId,
          subdomain: `denali-md-${discountMembershipTenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });

      assert.ok(getBookingsRepository() instanceof PrismaBookingsRepository);
      listener = createRequestListener();
    });

    after(async () => {
      if (admin === undefined) return;
      try {
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only"
        );
        const tenantIds = [tenantId, discountMembershipTenantId];
        await admin.financePaymentHold.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.financeCommercialQuote.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.financeRefund.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.paymentReceipt.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.operatorRegistration.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.auditEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await admin.tour.deleteMany({ where: { id: { in: tourIds } } });
        if (memberUserIds.length > 0) {
          await admin.user.deleteMany({ where: { id: { in: memberUserIds } } });
        }
        await admin.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      } finally {
        await admin.$executeRawUnsafe(
          "ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only"
        );
        await admin.$disconnect();
        await disconnectPrisma();
        resetBookingsRepositorySingletonForTests();
        resetBookingsServiceCompositionForTests();
      }
    });

    async function assertPersistedAndReloaded(input: {
      readonly bookingId: string;
      readonly scenario: Scenario;
      readonly expected: BookingState;
      readonly expectedPaymentStatus?: "paid" | "unpaid";
    }): Promise<void> {
      const row = await admin!.operatorRegistration.findUnique({ where: { id: input.bookingId } });
      assert.ok(row, `${input.scenario.id}: registration must persist in PostgreSQL`);
      assert.equal(row.tenantId, tenantId, `${input.scenario.id}: persisted tenant`);
      assert.equal(row.status, input.expected, `${input.scenario.id}: persisted status`);
      assert.equal(
        row.paymentStatus,
        input.expectedPaymentStatus ?? input.scenario.expectedPaymentStatus,
        `${input.scenario.id}: persisted payment status`
      );

      const detail = await requestJson(listener, {
        method: "GET",
        path: `/bookings/${encodeURIComponent(input.bookingId)}`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(
        detail.status,
        200,
        `${input.scenario.id}: detail reload ${JSON.stringify(detail.body)}`
      );
      assert.equal(detail.body.status, input.expected, `${input.scenario.id}: detail status`);
      assert.equal(
        detail.body.paymentStatus,
        input.expectedPaymentStatus ?? input.scenario.expectedPaymentStatus,
        `${input.scenario.id}: detail payment status`
      );

      const list = await requestJson(listener, {
        method: "GET",
        path: `/bookings?view=ops&tourId=${encodeURIComponent(row.tourId)}&limit=20`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(
        list.status,
        200,
        `${input.scenario.id}: list reload ${JSON.stringify(list.body)}`
      );
      const items = (list.body.items ?? []) as Array<Record<string, unknown>>;
      const listed = items.find((item) => item.id === input.bookingId);
      assert.ok(listed, `${input.scenario.id}: operator list must contain the row`);
      assert.equal(listed.status, input.expected, `${input.scenario.id}: list status`);
      assert.equal(
        listed.paymentStatus,
        input.expectedPaymentStatus ?? input.scenario.expectedPaymentStatus,
        `${input.scenario.id}: list payment status`
      );

      if (input.scenario.expectsPaymentHold) {
        const hold = await admin!.financePaymentHold.findUnique({
          where: { tenantId_registrationId: { tenantId, registrationId: input.bookingId } },
        });
        assert.ok(hold, `${input.scenario.id}: auto-approved paid booking must have a hold`);
        assert.equal(hold.status, "open");
        assert.equal(detail.body.paymentDueAt, hold.dueAt.toISOString());
      }
    }

    async function createRegistration(input: {
      readonly scenarioId: string;
      readonly collection: "free" | "offline";
      readonly approval: "manual" | "auto";
    }): Promise<{ tourId: string; bookingId: string; guestLabel: string }> {
      const tourId = randomUUID();
      tourIds.push(tourId);
      const title = `${input.scenarioId} ${tourId.slice(0, 8)}`;
      const seeded = buildDenaliBookingScenarioTour({
        tenantId,
        id: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
        title,
        registrationApproval: input.approval,
        paymentCollection: input.collection,
      });
      await admin!.tour.create({
        data: {
          id: tourId,
          tenantId,
          title,
          publishStatus: "published",
          canonical: seeded.canonical,
        },
      });
      const guestLabel = `${title} Guest`;
      const created = await requestJson(listener, {
        method: "POST",
        path: "/denali/registrations",
        tenantId,
        body: {
          tourId,
          contact: {
            fullName: guestLabel,
            phone: `+1555${String(Date.now() + tourIds.length).slice(-7)}`,
          },
          partySize: 1,
        },
      });
      assert.equal(
        created.status,
        201,
        `${input.scenarioId}: registration ${JSON.stringify(created.body)}`
      );
      const bookingId = (created.body.data as { id?: unknown } | undefined)?.id;
      assert.equal(typeof bookingId, "string", `${input.scenarioId}: registration id`);
      return { tourId, bookingId: bookingId as string, guestLabel };
    }

    async function rosterRows(tourId: string, filter: "final" | "operational" | "unpaid") {
      const response = await requestJson(listener, {
        method: "GET",
        path: `/tours/${encodeURIComponent(tourId)}/operational-roster?filter=${filter}&view=ops`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(response.status, 200, `${filter} roster ${JSON.stringify(response.body)}`);
      return (response.body.items ?? []) as Array<Record<string, unknown>>;
    }

    for (const [index, scenario] of scenarios.entries()) {
      it(`${scenario.id}: PostgreSQL row, detail, and operator list agree after reload`, async () => {
        const tourId = randomUUID();
        tourIds.push(tourId);
        const title = `PG Denali ${index + 1} ${tourId.slice(0, 8)}`;
        const seeded = buildDenaliBookingScenarioTour({
          tenantId,
          id: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
          title,
          registrationApproval: scenario.approval,
          paymentCollection: scenario.collection,
        });
        await admin!.tour.create({
          data: {
            id: tourId,
            tenantId,
            title,
            publishStatus: "published",
            canonical: seeded.canonical,
          },
        });

        const created = await requestJson(listener, {
          method: "POST",
          path: "/denali/registrations",
          tenantId,
          body: {
            tourId,
            contact: {
              fullName: `${title} Guest`,
              phone: `+1555${String(Date.now() + index).slice(-7)}`,
            },
            partySize: 1,
          },
        });
        assert.equal(
          created.status,
          201,
          `${scenario.id}: registration create ${JSON.stringify(created.body)}`
        );
        const data = created.body.data as { id?: unknown; status?: unknown } | undefined;
        assert.equal(typeof data?.id, "string", `${scenario.id}: registration id`);
        const bookingId = data!.id as string;
        assert.equal(data?.status, scenario.expectedInitial, `${scenario.id}: initial status`);
        await assertPersistedAndReloaded({
          bookingId,
          scenario,
          expected: scenario.expectedInitial,
          expectedPaymentStatus: scenario.expectedInitialPaymentStatus,
        });

        if (scenario.transition === undefined) return;
        const transitionPath =
          scenario.transition === "cancel"
            ? `/bookings/${encodeURIComponent(bookingId)}/cancel`
            : `/bookings/${encodeURIComponent(bookingId)}/${scenario.transition}`;
        const transitioned = await requestJson(listener, {
          method: "POST",
          path: transitionPath,
          tenantId,
          userId: ownerId,
          role: "owner",
          ...(scenario.transition === "reject"
            ? { body: { reason: "matrix fixture rejection" } }
            : {}),
          ...(scenario.transition === "cancel"
            ? { body: { reasonCode: "operator_correction" } }
            : {}),
        });
        assert.equal(
          transitioned.status,
          200,
          `${scenario.id}: ${scenario.transition} ${JSON.stringify(transitioned.body)}`
        );
        const expectedFinal = scenario.expectedFinal;
        assert.ok(expectedFinal);
        assert.equal(transitioned.body.status, expectedFinal, `${scenario.id}: transition result`);
        await assertPersistedAndReloaded({ bookingId, scenario, expected: expectedFinal });
      });
    }

    const discountCases = [
      {
        id: "BDISC-PG-01 eligible same-tenant member with gate",
        allowMembershipDiscount: true,
        membershipTenant: "booking",
        expectedPayableMinor: "4000000",
        expectDiscount: true,
      },
      {
        id: "BDISC-PG-02 eligible same-tenant member with gate closed",
        allowMembershipDiscount: false,
        membershipTenant: "booking",
        expectedPayableMinor: "5000000",
        expectDiscount: false,
      },
      {
        id: "BDISC-PG-03 guest without membership with gate",
        allowMembershipDiscount: true,
        membershipTenant: "guest",
        expectedPayableMinor: "5000000",
        expectDiscount: false,
      },
      {
        id: "BDISC-PG-04 other-tenant rewards cannot leak into booking tenant",
        allowMembershipDiscount: true,
        membershipTenant: "cross-tenant",
        expectedPayableMinor: "5000000",
        expectDiscount: false,
      },
    ] as const;

    for (const scenario of discountCases) {
      it(`${scenario.id}: HTTP registration freezes the correct PostgreSQL quote`, async () => {
        const isGuest = scenario.membershipTenant === "guest";
        const memberUserId = isGuest ? undefined : randomUUID();
        if (memberUserId !== undefined) {
          memberUserIds.push(memberUserId);
          await admin!.user.create({
            data: {
              id: memberUserId,
              mobile: `+1555${randomUUID().replace(/\D/g, "").slice(0, 10)}`,
            },
          });
        }
        if (scenario.membershipTenant === "booking") {
          await admin!.userTenant.create({
            data: {
              userId: memberUserId!,
              tenantId,
              role: "member",
              status: "ACTIVE",
              workspaceId: "ws-denali-booking-matrix",
              membershipMetadata: { rewards: { permanentDiscountPercentage: 20 } },
            },
          });
        } else if (scenario.membershipTenant === "cross-tenant") {
          await admin!.userTenant.createMany({
            data: [
              {
                userId: memberUserId!,
                tenantId,
                role: "member",
                status: "ACTIVE",
                workspaceId: "ws-denali-booking-matrix",
                membershipMetadata: {},
              },
              {
                userId: memberUserId!,
                tenantId: discountMembershipTenantId,
                role: "member",
                status: "ACTIVE",
                workspaceId: "ws-denali-discount-other",
                membershipMetadata: { rewards: { permanentDiscountPercentage: 20 } },
              },
            ],
          });
        }

        const tourId = randomUUID();
        tourIds.push(tourId);
        const title = `${scenario.id} ${tourId.slice(0, 8)}`;
        const seeded = buildDenaliBookingScenarioTour({
          tenantId,
          id: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
          title,
          registrationApproval: "auto",
          paymentCollection: "offline",
          allowMembershipDiscount: scenario.allowMembershipDiscount,
        });
        await admin!.tour.create({
          data: {
            id: tourId,
            tenantId,
            title,
            publishStatus: "published",
            canonical: seeded.canonical,
          },
        });

        const created = await requestJson(listener, {
          method: "POST",
          path: "/denali/registrations",
          tenantId,
          ...(memberUserId === undefined ? {} : { userId: memberUserId, role: "member" as const }),
          body: {
            tourId,
            ...(memberUserId === undefined ? {} : { registrantTarget: "self" }),
            contact: {
              fullName: `${title} Participant`,
              ...(memberUserId === undefined
                ? { phone: `+1555${randomUUID().replace(/\D/g, "").slice(0, 10)}` }
                : {}),
            },
            partySize: 2,
          },
        });
        assert.equal(created.status, 201, `${scenario.id}: ${JSON.stringify(created.body)}`);
        const registration = created.body.data as { id?: unknown; status?: unknown } | undefined;
        assert.equal(registration?.status, "approved", `${scenario.id}: auto approval`);
        assert.equal(typeof registration?.id, "string", `${scenario.id}: registration id`);
        const registrationId = registration!.id as string;

        const persistedBooking = await admin!.operatorRegistration.findFirst({
          where: { id: registrationId, tenantId },
          select: { submittedByUserId: true, registrationIntake: true, status: true },
        });
        if (memberUserId !== undefined) {
          assert.equal(persistedBooking?.submittedByUserId, memberUserId, `${scenario.id}: member`);
        }
        assert.equal(persistedBooking?.status, "approved", `${scenario.id}: persisted status`);
        if (memberUserId !== undefined) {
          assert.equal(
            (persistedBooking?.registrationIntake as { registrantTarget?: string } | null)
              ?.registrantTarget,
            "self",
            `${scenario.id}: self participant must be used for discount eligibility`
          );
        }

        const quote = await admin!.financeCommercialQuote.findFirst({
          where: { tenantId, registrationId, status: "FROZEN" },
        });
        assert.ok(quote, `${scenario.id}: frozen quote must persist`);
        assert.equal(quote.grossMinor, "5000000", `${scenario.id}: canonical gross`);
        assert.equal(
          quote.payableMinor,
          scenario.expectedPayableMinor,
          `${scenario.id}: payable amount`
        );
        if (scenario.expectDiscount) {
          assert.equal(quote.source, "member_discount");
          assert.equal(quote.memberDiscountPercentageApplied, 20);
          assert.equal(quote.memberDiscountMinor, "1000000");
          assert.equal(quote.memberDiscountMemberUserId, memberUserId);
          assert.equal(
            quote.memberDiscountMembershipReference,
            `userTenant:${tenantId}:${memberUserId}`
          );
        } else {
          assert.notEqual(quote.source, "member_discount");
          assert.equal(quote.memberDiscountPercentageApplied, null);
          assert.equal(quote.memberDiscountMinor, null);
          assert.equal(quote.memberDiscountMemberUserId, null);
          assert.equal(quote.memberDiscountMembershipReference, null);
        }
      });
    }

    it("B-09 explicitly finalized unpaid booking stays in final and payment follow-up rosters", async () => {
      const { tourId, bookingId, guestLabel } = await createRegistration({
        scenarioId: "B-09 unpaid finalized",
        collection: "offline",
        approval: "manual",
      });
      const approved = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId)}/approve`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(approved.status, 200, `B-09 approve ${JSON.stringify(approved.body)}`);

      const finalized = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId)}/finalize-with-open-payment`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(
        finalized.status,
        200,
        `B-09 finalize with open payment ${JSON.stringify(finalized.body)}`
      );
      const persisted = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId, tenantId },
        select: { status: true, paymentStatus: true, finalizationStatus: true },
      });
      assert.deepEqual(persisted, {
        status: "approved",
        paymentStatus: "unpaid",
        finalizationStatus: "finalized",
      });

      const finalRow = (await rosterRows(tourId, "final")).find(
        (row) => row.registrationId === bookingId
      );
      assert.equal(finalRow?.isFinalParticipant, true);
      assert.equal(finalRow?.financialDisplayState, "UNPAID");
      assert.equal(finalRow?.isFinanciallySettled, false);
      const followupRow = (await rosterRows(tourId, "unpaid")).find(
        (row) => row.registrationId === bookingId
      );
      assert.equal(followupRow?.isFinalParticipant, true);
      assert.equal(followupRow?.financialDisplayState, "UNPAID");

      const exported = await requestBytes(listener, {
        method: "GET",
        path: `/tours/${encodeURIComponent(tourId)}/operational-roster/export?filter=final&format=xlsx`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(exported.status, 200, "B-09 final roster export must succeed");
      assert.equal(
        exported.headers["content-type"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exported.body);
      const finalSheet = workbook.getWorksheet("لیست نهایی");
      const paymentFollowupSheet = workbook.getWorksheet("منتظر پرداخت");
      assert.ok(finalSheet, "B-09 final roster worksheet must exist");
      assert.ok(paymentFollowupSheet, "B-09 payment follow-up worksheet must exist");
      const finalExportRow = finalSheet
        .getRows(2, Math.max(0, finalSheet.rowCount - 1))
        ?.find((row) => row.getCell(2).value === guestLabel);
      const followupExportRow = paymentFollowupSheet
        .getRows(2, Math.max(0, paymentFollowupSheet.rowCount - 1))
        ?.find((row) => row.getCell(2).value === guestLabel);
      assert.ok(finalExportRow, "B-09 must appear in the final roster export");
      assert.ok(followupExportRow, "B-09 debt must remain in payment follow-up export");
    });

    it("B-10 paid but not-final legacy row stays out of the final roster", async () => {
      const { tourId, bookingId } = await createRegistration({
        scenarioId: "B-10 paid not final",
        collection: "free",
        approval: "auto",
      });
      await admin!.operatorRegistration
        .updateMany({
          where: { id: bookingId, tenantId, status: "approved", paymentStatus: "paid" },
          data: { finalizationStatus: "not_final", finalizedAt: null, finalizedByUserId: null },
        })
        .then((result) => assert.equal(result.count, 1, "B-10 fixture must be paid and approved"));

      const persisted = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId, tenantId },
        select: { status: true, paymentStatus: true, finalizationStatus: true },
      });
      assert.deepEqual(persisted, {
        status: "approved",
        paymentStatus: "paid",
        finalizationStatus: "not_final",
      });
      assert.equal(
        (await rosterRows(tourId, "final")).some((row) => row.registrationId === bookingId),
        false
      );
      const operationalRow = (await rosterRows(tourId, "operational")).find(
        (row) => row.registrationId === bookingId
      );
      assert.equal(operationalRow?.isOperationalParticipant, true);
      assert.equal(operationalRow?.isFinalParticipant, false);
    });

    it("B-12 stale finalization metadata cannot admit terminal rows to the roster", async () => {
      for (const status of ["waitlisted", "rejected", "cancelled"] as const) {
        const { tourId, bookingId } = await createRegistration({
          scenarioId: `B-12 stale finalized ${status}`,
          collection: "offline",
          approval: "manual",
        });
        const changed = await admin!.operatorRegistration.updateMany({
          where: { id: bookingId, tenantId },
          data: { status, finalizationStatus: "finalized", finalizedAt: new Date() },
        });
        assert.equal(changed.count, 1, `B-12 must seed the owned ${status} fixture`);
        assert.equal(
          (await rosterRows(tourId, "final")).some((row) => row.registrationId === bookingId),
          false,
          `${status} with stale finalized metadata must stay out of final roster`
        );
        assert.equal(
          (await rosterRows(tourId, "operational")).some((row) => row.registrationId === bookingId),
          false,
          `${status} with stale finalized metadata must stay out of operational roster`
        );
      }
    });

    it("paid member cancellation request survives API repository restart and is reloadable", async () => {
      const memberUserId = randomUUID();
      memberUserIds.push(memberUserId);
      await admin!.user.create({
        data: {
          id: memberUserId,
          mobile: `+1555${randomUUID().replace(/\D/g, "").slice(0, 10)}`,
        },
      });
      await admin!.userTenant.create({
        data: {
          userId: memberUserId,
          tenantId,
          role: "member",
          status: "ACTIVE",
          workspaceId: "ws-denali-booking-matrix",
          membershipMetadata: {},
        },
      });

      const tourId = randomUUID();
      tourIds.push(tourId);
      const title = `PG cancellation request ${tourId.slice(0, 8)}`;
      const seeded = buildDenaliBookingScenarioTour({
        tenantId,
        id: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
        title,
        registrationApproval: "auto",
        paymentCollection: "offline",
      });
      await admin!.tour.create({
        data: {
          id: tourId,
          tenantId,
          title,
          publishStatus: "published",
          canonical: seeded.canonical,
        },
      });
      const created = await requestJson(listener, {
        method: "POST",
        path: "/denali/registrations",
        tenantId,
        userId: memberUserId,
        role: "member",
        body: {
          tourId,
          registrantTarget: "self",
          contact: {
            fullName: `${title} Member`,
            phone: `+1555${randomUUID().replace(/\D/g, "").slice(0, 10)}`,
          },
          partySize: 1,
        },
      });
      assert.equal(created.status, 201, `cancellation fixture ${JSON.stringify(created.body)}`);
      const bookingId = (created.body.data as { id?: unknown } | undefined)?.id;
      assert.equal(typeof bookingId, "string", "cancellation booking id");

      // Seed the already-settled state as the scenario precondition. This test
      // isolates durable cancellation-request state; receipt/ledger settlement
      // is covered by the independent booking-finance integration and browser tests.
      const settledAt = new Date();
      const settled = await admin!.operatorRegistration.updateMany({
        where: { id: bookingId as string, tenantId, status: "approved" },
        data: {
          paymentStatus: "paid",
          finalizationStatus: "finalized",
          finalizedAt: settledAt,
          finalizedByUserId: ownerId,
        },
      });
      assert.equal(
        settled.count,
        1,
        "cancellation fixture must be approved before settlement seed"
      );

      const requested = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation`,
        tenantId,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(requested.status, 200, `request cancellation ${JSON.stringify(requested.body)}`);
      assert.equal(requested.body.kind, "request_submitted");

      const persisted = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId as string, tenantId },
        select: {
          status: true,
          paymentStatus: true,
          finalizationStatus: true,
          cancellationStatus: true,
          cancellationRequestedAt: true,
          cancellationReasonCode: true,
        },
      });
      assert.deepEqual(persisted, {
        status: "approved",
        paymentStatus: "paid",
        finalizationStatus: "finalized",
        cancellationStatus: "request_pending",
        cancellationRequestedAt: persisted?.cancellationRequestedAt,
        cancellationReasonCode: "member_cancellation_request",
      });
      assert.ok(persisted?.cancellationRequestedAt, "request timestamp must persist in PostgreSQL");
      const requestEvent = await admin!.outboxEvent.findFirst({
        where: {
          tenantId,
          aggregateType: "registration",
          aggregateId: bookingId as string,
          eventType: "registration.cancellation_requested",
        },
      });
      assert.ok(requestEvent, "cancellation-request outbox event must commit with the request");

      resetLazyRouteHandlersForTests();
      resetLazyFinanceServiceForTests();
      resetLazyWorkspaceFinanceHandlersForTests();
      resetBookingsRepositorySingletonForTests();
      resetBookingsServiceCompositionForTests();
      await disconnectPrisma();
      assert.ok(getBookingsRepository() instanceof PrismaBookingsRepository);
      listener = createRequestListener();

      const reloaded = await requestJson(listener, {
        method: "GET",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation`,
        tenantId,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(reloaded.status, 200, `reload cancellation ${JSON.stringify(reloaded.body)}`);
      assert.equal(reloaded.body.cancellationStatus, "request_pending");
      assert.equal(reloaded.body.eligible, true);
      assert.equal(reloaded.body.mode, "request");

      const afterRestart = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId as string, tenantId },
        select: { status: true, paymentStatus: true, finalizationStatus: true },
      });
      assert.deepEqual(afterRestart, {
        status: "approved",
        paymentStatus: "paid",
        finalizationStatus: "finalized",
      });

      const rejected = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation/reject`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(rejected.status, 200, `reject cancellation ${JSON.stringify(rejected.body)}`);
      assert.deepEqual(rejected.body, {
        bookingId,
        cancellationStatus: "rejected",
      });
      const rejectedRow = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId as string, tenantId },
        select: {
          status: true,
          paymentStatus: true,
          finalizationStatus: true,
          cancellationStatus: true,
        },
      });
      assert.deepEqual(rejectedRow, {
        status: "approved",
        paymentStatus: "paid",
        finalizationStatus: "finalized",
        cancellationStatus: "rejected",
      });
      const rejectionEvent = await admin!.outboxEvent.findFirst({
        where: {
          tenantId,
          aggregateType: "registration",
          aggregateId: bookingId as string,
          eventType: "registration.cancellation_request_rejected",
        },
      });
      assert.ok(rejectionEvent, "cancellation rejection outbox event must persist");
      assert.equal(
        (rejectionEvent.payload as Record<string, unknown>).rejectedByUserId,
        ownerId,
        "rejection event must retain the operator identity"
      );

      const rejectedReload = await requestJson(listener, {
        method: "GET",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation`,
        tenantId,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(rejectedReload.status, 200);
      assert.equal(rejectedReload.body.cancellationStatus, "rejected");
      assert.equal(rejectedReload.body.eligible, true);
      assert.equal(rejectedReload.body.mode, "request");

      const resubmitted = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation`,
        tenantId,
        userId: memberUserId,
        role: "member",
      });
      assert.equal(
        resubmitted.status,
        200,
        `resubmit cancellation ${JSON.stringify(resubmitted.body)}`
      );
      assert.equal(resubmitted.body.kind, "request_submitted");

      const approved = await requestJson(listener, {
        method: "POST",
        path: `/bookings/${encodeURIComponent(bookingId as string)}/member-cancellation/approve`,
        tenantId,
        userId: ownerId,
        role: "owner",
      });
      assert.equal(approved.status, 200, `approve cancellation ${JSON.stringify(approved.body)}`);
      assert.equal(approved.body.kind, "cancelled");
      assert.equal(approved.body.bookingId, bookingId);
      assert.equal(approved.body.status, "cancelled");
      assert.equal(approved.body.refundStatus, "pending_finance_approval");
      const cancelledRow = await admin!.operatorRegistration.findFirst({
        where: { id: bookingId as string, tenantId },
        select: {
          status: true,
          paymentStatus: true,
          finalizationStatus: true,
          cancellationStatus: true,
          cancellationApprovedByUserId: true,
        },
      });
      assert.deepEqual(cancelledRow, {
        status: "cancelled",
        paymentStatus: "paid",
        finalizationStatus: "not_final",
        cancellationStatus: "applied",
        cancellationApprovedByUserId: ownerId,
      });
    });
  }
);
