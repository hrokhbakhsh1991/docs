import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, it } from "node:test";

import {
  handleGetProfileCertCatalog,
  handleGetProfileCertCatalogTour,
  handlePostProfileCertRegistration,
} from "../src/http/profile-cert-catalog-http";
import {
  buildProfileCertSmokeCatalogCard,
  PROFILE_CERT_SMOKE_TOUR_ID,
  PROFILE_CERT_SMOKE_TOUR_TITLE,
} from "../src/catalog/profile-cert-smoke-catalog.fixture";

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

describe("profile-cert guest smoke catalog fixture", () => {
  it("builds an Event card with stable id", () => {
    const card = buildProfileCertSmokeCatalogCard();
    assert.equal(card.id, PROFILE_CERT_SMOKE_TOUR_ID);
    assert.equal(card.title, PROFILE_CERT_SMOKE_TOUR_TITLE);
    assert.equal(
      (card.structuredData as { readonly "@type"?: string } | undefined)?.["@type"],
      "Event",
    );
  });
});

describe("profile-cert guest catalog HTTP", () => {
  it("defaults to guest stub when smoke seed disabled", async () => {
    delete process.env.PROFILE_CERT_SMOKE_E2E_SEED;
    const res = mockRes();
    await handleGetProfileCertCatalog({ url: "/profile-cert/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 501);
    assert.match(res.body, /WORKSPACE_GUEST_STUB/);
  });

  it("lists smoke card when seed enabled", async () => {
    process.env.PROFILE_CERT_SMOKE_E2E_SEED = "1";
    const res = mockRes();
    await handleGetProfileCertCatalog({ url: "/profile-cert/catalog" } as IncomingMessage, res);
    assert.equal(res.status, 200);
    const parsed = JSON.parse(res.body) as {
      success: boolean;
      data: { items: Array<{ id: string }> };
      metadata: { nextCursor: null };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.items[0]?.id, PROFILE_CERT_SMOKE_TOUR_ID);
    assert.equal(parsed.metadata.nextCursor, null);
    delete process.env.PROFILE_CERT_SMOKE_E2E_SEED;
  });

  it("returns detail and accepts registration under seed", async () => {
    process.env.PROFILE_CERT_SMOKE_E2E_SEED = "1";
    const detail = mockRes();
    await handleGetProfileCertCatalogTour({} as IncomingMessage, detail, PROFILE_CERT_SMOKE_TOUR_ID);
    assert.equal(detail.status, 200);

    const created = mockRes();
    await handlePostProfileCertRegistration(
      mockJsonReq({
        tourId: PROFILE_CERT_SMOKE_TOUR_ID,
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
    assert.equal(parsed.data.tourId, PROFILE_CERT_SMOKE_TOUR_ID);
    assert.equal(parsed.data.status, "pending");
    delete process.env.PROFILE_CERT_SMOKE_E2E_SEED;
  });
});
