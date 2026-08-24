import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  handleGetCertEventsCatalog,
  handleGetCertEventsCatalogTour,
  handlePostCertEventsRegistration,
} from "../src/http/cert-events-catalog-http";
import {
  buildCertEventsSmokeCatalogCard,
  CERT_EVENTS_SMOKE_TOUR_ID,
  CERT_EVENTS_SMOKE_TOUR_TITLE,
} from "../src/catalog/cert-events-smoke-catalog.fixture";

function mockRes(): ServerResponse & {
  readonly body: string;
  readonly status: number;
} {
  let body = "";
  let status = 0;
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
    setHeader() {},
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

describe("cert-events guest smoke catalog fixture", () => {
  it("builds an Event card with stable id", () => {
    const card = buildCertEventsSmokeCatalogCard();
    assert.equal(card.id, CERT_EVENTS_SMOKE_TOUR_ID);
    assert.equal(card.title, CERT_EVENTS_SMOKE_TOUR_TITLE);
    assert.equal(
      (card.structuredData as { readonly "@type"?: string } | undefined)?.["@type"],
      "Event",
    );
  });
});

describe("cert-events guest catalog HTTP", () => {
  it("defaults to guest stub when smoke seed disabled", async () => {
    delete process.env.CERT_EVENTS_SMOKE_E2E_SEED;
    const res = mockRes();
    await handleGetCertEventsCatalog({ url: "/cert-events/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 501);
    assert.match(res.body, /WORKSPACE_GUEST_STUB/);
  });

  it("lists smoke card when seed enabled", async () => {
    process.env.CERT_EVENTS_SMOKE_E2E_SEED = "1";
    const res = mockRes();
    await handleGetCertEventsCatalog({ url: "/cert-events/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body) as {
      success: boolean;
      data: { items: Array<{ id: string }> };
      metadata: { nextCursor: null };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.items[0]?.id, CERT_EVENTS_SMOKE_TOUR_ID);
    assert.equal(parsed.metadata.nextCursor, null);
    delete process.env.CERT_EVENTS_SMOKE_E2E_SEED;
  });

  it("returns detail and accepts registration under seed", async () => {
    process.env.CERT_EVENTS_SMOKE_E2E_SEED = "1";
    const detail = mockRes();
    await handleGetCertEventsCatalogTour({} as IncomingMessage, detail, CERT_EVENTS_SMOKE_TOUR_ID);
    assert.equal(detail.status, 200);

    const created = mockRes();
    await handlePostCertEventsRegistration(
      mockJsonReq({
        tourId: CERT_EVENTS_SMOKE_TOUR_ID,
        contact: { fullName: "Ada Guest", email: "ada@example.com" },
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
    assert.equal(parsed.data.tourId, CERT_EVENTS_SMOKE_TOUR_ID);
    assert.equal(parsed.data.status, "pending");
    delete process.env.CERT_EVENTS_SMOKE_E2E_SEED;
  });
});
