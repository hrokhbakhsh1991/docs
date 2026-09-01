import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  handleGetHarborCatalog,
  handleGetHarborCatalogTour,
  handlePostHarborRegistration,
} from "../src/http/harbor-catalog-http";
import {
  configureHarborHttpHost,
  resetHarborHttpHostForTests,
} from "../src/http/harbor-http-host";
import {
  buildHarborSmokeCatalogCard,
  HARBOR_SMOKE_PUBLISHED_TOUR_CITY,
  HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  HARBOR_SMOKE_PUBLISHED_TOUR_TITLE,
} from "../src/catalog/harbor-smoke-catalog";
import {
  getHarborSmokeCatalogStore,
  resetHarborSmokeCatalogStoreForTests,
} from "../src/catalog/harbor-smoke-catalog";
import type { CanonicalDocument } from "@app-tour/workspace-sdk";

function mockRes(): ServerResponse & {
  readonly body: string;
  readonly status: number;
} {
  let body = "";
  let status = 0;
  const headers: Record<string, string> = {};
  const res = {
    get body() {
      return body;
    },
    get status() {
      return status;
    },
    set statusCode(value: number) {
      status = value;
    },
    get statusCode() {
      return status;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    end(chunk?: string) {
      body = chunk ?? "";
    },
  };
  return res as unknown as ServerResponse & { readonly body: string; readonly status: number };
}

function mockJsonReq(payload: unknown): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & EventEmitter;
  queueMicrotask(() => {
    req.emit("data", Buffer.from(JSON.stringify(payload), "utf8"));
    req.emit("end");
  });
  return req;
}

describe("DG-4.1 harbor smoke catalog fixture", () => {
  it("builds a city Event card with stable id", () => {
    const card = buildHarborSmokeCatalogCard();
    assert.equal(card.id, HARBOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(card.title, HARBOR_SMOKE_PUBLISHED_TOUR_TITLE);
    assert.equal(card.category, "city_sail");
    assert.equal(card.city, HARBOR_SMOKE_PUBLISHED_TOUR_CITY);
    assert.equal(
      (card.structuredData as { readonly "@type"?: string } | undefined)?.["@type"],
      "Event",
    );
  });
});

describe("DG-4.1 harbor catalog HTTP", () => {
  it("defaults to guest stub when smoke seed disabled", async () => {
    delete process.env.HARBOR_SMOKE_E2E_SEED;
    resetHarborSmokeCatalogStoreForTests();
    resetHarborHttpHostForTests();
    const res = mockRes();
    await handleGetHarborCatalog({ url: "/harbor/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 501);
    assert.match(res.body, /WORKSPACE_GUEST_STUB/);
  });

  it("lists smoke card when seed enabled", async () => {
    process.env.HARBOR_SMOKE_E2E_SEED = "1";
    resetHarborSmokeCatalogStoreForTests();
    const res = mockRes();
    await handleGetHarborCatalog({ url: "/harbor/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body) as {
      success: boolean;
      data: { items: Array<{ id: string }> };
      metadata: { nextCursor: null };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.items[0]?.id, HARBOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(parsed.metadata.nextCursor, null);
    delete process.env.HARBOR_SMOKE_E2E_SEED;
  });

  it("filters list by city query (DG-4.2)", async () => {
    process.env.HARBOR_SMOKE_E2E_SEED = "1";
    resetHarborSmokeCatalogStoreForTests();
    const miss = mockRes();
    await handleGetHarborCatalog(
      { url: "/harbor/catalog?city=tehran" } as IncomingMessage,
      miss,
    );
    assert.equal(miss.status, 200);
    assert.deepEqual(JSON.parse(miss.body).data.items, []);

    const hit = mockRes();
    await handleGetHarborCatalog(
      { url: `/harbor/catalog?city=${HARBOR_SMOKE_PUBLISHED_TOUR_CITY}` } as IncomingMessage,
      hit,
    );
    assert.equal(hit.status, 200);
    assert.equal(JSON.parse(hit.body).data.items[0]?.id, HARBOR_SMOKE_PUBLISHED_TOUR_ID);
    delete process.env.HARBOR_SMOKE_E2E_SEED;
  });

  it("returns detail and accepts registration under seed", async () => {
    process.env.HARBOR_SMOKE_E2E_SEED = "1";
    resetHarborSmokeCatalogStoreForTests();
    const detail = mockRes();
    await handleGetHarborCatalogTour({} as IncomingMessage, detail, HARBOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(detail.status, 200);

    const created = mockRes();
    await handlePostHarborRegistration(
      mockJsonReq({
        tourId: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { fullName: "Ada Harbor", email: "ada@example.com" },
        partySize: 2,
      }),
      created,
    );
    assert.equal(created.status, 201);
    const parsed = JSON.parse(created.body) as {
      success: boolean;
      data: { tourId: string; status: string };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.tourId, HARBOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(parsed.data.status, "pending");
    delete process.env.HARBOR_SMOKE_E2E_SEED;
  });

  it("persists registrations in the smoke catalog store (DG-4.6)", async () => {
    process.env.HARBOR_SMOKE_E2E_SEED = "1";
    resetHarborSmokeCatalogStoreForTests();

    await handlePostHarborRegistration(
      mockJsonReq({
        tourId: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { fullName: "Bess Harbor", email: "bess@example.com" },
        partySize: 1,
      }),
      mockRes(),
    );
    await handlePostHarborRegistration(
      mockJsonReq({
        tourId: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { fullName: "Cora Harbor", email: "cora@example.com" },
        partySize: 3,
      }),
      mockRes(),
    );

    const regs = getHarborSmokeCatalogStore().listRegistrations();
    assert.equal(regs.length, 2);
    assert.equal(regs[0]?.fullName, "Bess Harbor");
    assert.equal(regs[1]?.fullName, "Cora Harbor");
    delete process.env.HARBOR_SMOKE_E2E_SEED;
  });

  it("PSR-6c3/6c4 durable list/detail/register when host configured (seed off)", async () => {
    delete process.env.HARBOR_SMOKE_E2E_SEED;
    resetHarborSmokeCatalogStoreForTests();
    resetHarborHttpHostForTests();

    const tourId = "00000000-0000-4000-8000-000000000777";
    const canonical = {
      schemaVersion: 1,
      roots: [],
      data: {
        title: "Durable sail",
        city: "bandar",
        shortDescription: "From store",
        category: "city_sail",
        publishStatus: "published",
        departureAt: "2026-11-01T10:00:00.000Z",
        priceAmount: 10,
        priceCurrency: "IRR",
      },
    } as CanonicalDocument;

    configureHarborHttpHost({
      runWithHttpRequestContext: async (_req, _auth, fn) => fn(),
      sendJson: (res, status, body) => {
        (res as ServerResponse & { statusCode: number }).statusCode = status;
        res.end(JSON.stringify(body));
      },
      sendHttpError: () => undefined,
      handleHttpError: (res, error) => {
        const coded = error as { code?: string; httpStatus?: number };
        (res as ServerResponse & { statusCode: number }).statusCode =
          coded.httpStatus ?? 500;
        res.end(JSON.stringify({ code: coded.code ?? "ERROR" }));
      },
      resolveWorkspaceTypeForTenant: async () => "harbor",
      resolveTourStore: async () => ({
        listPage: async () => ({
          items: [
            {
              id: tourId,
              createdAt: "2026-08-01T00:00:00.000Z",
              canonical,
            },
          ],
        }),
        findFirst: async ({ id }) =>
          id === tourId
            ? {
                id: tourId,
                createdAt: "2026-08-01T00:00:00.000Z",
                canonical,
              }
            : null,
      }),
      resolvePublicBookingPort: () => ({
        findDuplicateByTourGuest: async () => null,
        findDuplicateByTourGuestLabel: async () => null,
        findDuplicateByTourGuestNationalId: async () => null,
        findDuplicateByTourGuestPhone: async () => null,
        findDuplicateByTourEmail: async () => null,
        findOwnedBooking: async () => null,
        mergeOwnedRegistrationIntake: async () => null,
        createPendingBooking: async (input) => ({
          id: "reg-durable-1",
          status: "pending",
          tourId: input.tourId,
        }),
        autoApprovePublicBooking: async () => ({
          id: "reg-durable-1",
          status: "approved",
        }),
        sumApprovedPartySizeByTourIds: async () => ({}),
      }),
      readHarborRegistrationRequestBody: async () => ({
        tourId,
        contact: { fullName: "No Seed", email: "n@example.com" },
        partySize: 1,
      }),
    });

    const list = mockRes();
    await handleGetHarborCatalog(
      {
        url: "/harbor/catalog",
        headers: { "x-tenant-id": "fbdcae8a-2cd8-4c2c-898c-f408bd51321a" },
      } as IncomingMessage,
      list,
    );
    assert.equal(list.status, 200);
    assert.equal(JSON.parse(list.body).data.items[0]?.id, tourId);
    assert.equal(JSON.parse(list.body).data.items[0]?.city, "bandar");

    const detail = mockRes();
    await handleGetHarborCatalogTour(
      {
        headers: { "x-tenant-id": "fbdcae8a-2cd8-4c2c-898c-f408bd51321a" },
      } as IncomingMessage,
      detail,
      tourId,
    );
    assert.equal(detail.status, 200);
    assert.equal(JSON.parse(detail.body).data.id, tourId);

    const register = mockRes();
    const regReq = mockJsonReq({
      tourId,
      contact: { fullName: "No Seed", email: "n@example.com" },
      partySize: 1,
    });
    (regReq as IncomingMessage & { headers: Record<string, string> }).headers = {
      "x-tenant-id": "fbdcae8a-2cd8-4c2c-898c-f408bd51321a",
    };
    await handlePostHarborRegistration(regReq, register);
    assert.equal(register.status, 201, register.body);
    assert.equal(JSON.parse(register.body).data.id, "reg-durable-1");

    resetHarborHttpHostForTests();
  });
});
