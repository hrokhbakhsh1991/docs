/**
 * Denali public catalog HTTP — marketing app backend (ADR-MKT-002)
 * Authority: docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  resetBookingsRepositoryForTests,
  resetBookingsRepositorySingletonForTests,
} from "../src/bookings/create-bookings-repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_SMOKE_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";
const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212";
const OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID = "00000000-0000-4000-8000-000000000213";
const OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID = "00000000-0000-4000-8000-000000000214";

function publicHeaders(tenantId = OPERATOR_SMOKE_TENANT_ID): Record<string, string> {
  return { "x-tenant-id": tenantId };
}

async function requestDenali(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET",
  path: string,
  options?: { headers?: Record<string, string> }
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: options?.headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
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

describe("denali-catalog", () => {
  installMemoryStorageDriverForDescribe();

  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    const toursService = createTestToursService(repo);
    listener = createRequestListener({ toursService, tourStore: repo });
  });

  it("DCAT-01 GET /denali/catalog lists published tours only", async () => {
    const response = await requestDenali(listener, "GET", "/denali/catalog", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 200);
    const items = (response.body as { data?: { items?: { id: string }[] } }).data?.items ?? [];
    assert.equal(items.length, 4);
    const ids = items.map((item) => item.id).sort();
    assert.deepEqual(
      ids,
      [
        OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
        OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
        OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
      ].sort()
    );
  });

  it("DCAT-02 GET /denali/catalog/{tourId} returns 404 for draft tour", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_DRAFT_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 404);
  });

  it("DCAT-03 GET /denali/catalog/{tourId} returns 200 for published tour", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as { data?: { id?: string; title?: string } }).data;
    assert.equal(data?.id, OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(data?.title, "North Ridge Trek");
  });

  it("DCAT-04 GET /denali/catalog/{tourId} includes spotsRemaining from approved bookings", async () => {
    resetBookingsRepositorySingletonForTests();
    const bookingsRepo = resetBookingsRepositoryForTests();
    bookingsRepo.seedBooking({
      id: "00000000-0000-4000-8000-000000000399",
      tenantId: OPERATOR_SMOKE_TENANT_ID,
      tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
      tourTitle: "North Ridge Trek",
      guestLabel: "Test Guest",
      guestEmail: "spots@example.com",
      guestPhone: null,
      partySize: 4,
      status: "approved",
      paymentStatus: "paid",
      departureAt: "2026-07-01T08:00:00.000Z",
      submittedAt: new Date().toISOString(),
      submittedByUserId: "00000000-0000-4000-8000-000000000101",
      approvedAt: new Date().toISOString(),
    });

    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as { data?: { spotsRemaining?: number; totalCapacity?: number } })
      .data;
    assert.equal(data?.totalCapacity, 12);
    assert.equal(data?.spotsRemaining, 8);
  });

  it("DCAT-05 GET /denali/catalog/{tourId} includes itineraryDays for multi-day smoke tour", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as {
      data?: {
        itineraryDays?: Array<{ title?: string; segments?: Array<{ title?: string; photoUrls?: string[] }> }>;
      };
    }).data;
    assert.equal(data?.itineraryDays?.length, 2);
    assert.equal(data?.itineraryDays?.[0]?.title, "Summit push");
    assert.equal(data?.itineraryDays?.[0]?.segments?.[0]?.title, "Ridge ascent");
    assert.equal(data?.itineraryDays?.[0]?.segments?.[0]?.photoUrls?.[0], "https://cdn.example/north-ridge.jpg");
  });

  it("DCAT-06 GET /denali/catalog/{tourId} includes policiesText for legal step", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as {
      data?: {
        policiesText?: string;
        cancellationDeadlineHours?: number;
        cancellationPenaltyPercentage?: number;
      };
    }).data;
    assert.match(data?.policiesText ?? "", /P7 staging: cancel 48h/);
    assert.equal(data?.cancellationDeadlineHours, 48);
    assert.equal(data?.cancellationPenaltyPercentage, 20);
  });

  it("DCAT-07 GET /denali/catalog/{tourId} exposes participant requirement flags on smoke tour 212", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      `/denali/catalog/${OPERATOR_SMOKE_PARTICIPANT_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as {
      data?: {
        id?: string;
        title?: string;
        nationalIdRequired?: boolean;
        fatherNameRequired?: boolean;
        birthDateRequired?: boolean;
      };
    }).data;
    assert.equal(data?.id, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID);
    assert.equal(data?.title, "Alpine Identity Check");
    assert.equal(data?.nationalIdRequired, true);
    assert.equal(data?.fatherNameRequired, true);
    assert.equal(data?.birthDateRequired, true);
  });

  it("DCAT-08 GET /denali/catalog filters by category before pagination", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      "/denali/catalog?category=mountain_multi",
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const items =
      (response.body as { data?: { items?: { id: string; category?: string }[] } }).data?.items ??
      [];
    assert.ok(items.length > 0);
    for (const item of items) {
      assert.equal(item.category, "mountain_multi");
    }
    assert.ok(items.some((item) => item.id === OPERATOR_SMOKE_PUBLISHED_TOUR_ID));
  });

  it("DCAT-09 GET /denali/catalog filters by q on title", async () => {
    const response = await requestDenali(listener, "GET", "/denali/catalog?q=north", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 200);
    const items =
      (response.body as { data?: { items?: { id: string; title?: string }[] } }).data?.items ?? [];
    assert.ok(items.length >= 1);
    assert.ok(items.every((item) => item.title?.toLowerCase().includes("north")));
  });

  it("DCAT-10 GET /denali/catalog sort=departure_asc orders by start date", async () => {
    const response = await requestDenali(
      listener,
      "GET",
      "/denali/catalog?sort=departure_asc&limit=50",
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const items =
      (response.body as { data?: { items?: { departureAt?: string | null }[] } }).data?.items ?? [];
    const timestamps = items
      .map((item) => item.departureAt)
      .filter((value): value is string => value != null && value.length > 0)
      .map((value) => Date.parse(value))
      .filter((value) => Number.isFinite(value));
    for (let index = 1; index < timestamps.length; index += 1) {
      assert.ok(timestamps[index]! >= timestamps[index - 1]!);
    }
  });
});
