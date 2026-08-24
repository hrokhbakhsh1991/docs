import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createCertClubTourWorkspacePolicyValidator } from "../src/policy/tour-policy";
import {
  handleGetCertClubCatalog,
  handleGetCertClubCatalogTour,
  handlePostCertClubRegistration,
} from "../src/http/cert-club-catalog-http";
import {
  buildCertClubSmokeCatalogCard,
  CERT_CLUB_SMOKE_TOUR_ID,
} from "../src/catalog/cert-club-smoke-catalog.fixture";
import { readCertClubCatalogTransportSnapshot } from "../src/transport/catalog-transport-snapshot";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

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

describe("cert-club full behavior certification (CW9-04)", () => {
  it("CW9-04-01 draft validation — policy rejects short title", () => {
    const validator = createCertClubTourWorkspacePolicyValidator();
    const violation = validator.validate({
      workspaceType: "cert-club",
      tenantId: "cert-club-behavior",
      document: {
        data: { basics: { title: "ab" } },
      },
    } as never);
    assert.equal(violation?.code, "CERT_CLUB_TITLE_TOO_SHORT");
  });

  it("CW9-04-02 draft validation — policy rejects blocked word", () => {
    const validator = createCertClubTourWorkspacePolicyValidator();
    const violation = validator.validate({
      workspaceType: "cert-club",
      tenantId: "cert-club-behavior",
      document: {
        data: { basics: { title: "Forbidden hike" } },
      },
    } as never);
    assert.equal(violation?.code, "CERT_CLUB_BLOCKED_WORD");
  });

  it("CW9-04-03 publish visibility — smoke catalog exposes published tour with capacity", () => {
    const card = buildCertClubSmokeCatalogCard();
    assert.equal(card.id, CERT_CLUB_SMOKE_TOUR_ID);
    assert.equal(card.totalCapacity, 20);
    assert.ok(card.departureAt);
  });

  it("CW9-04-04 public catalog list/detail when seed enabled", async () => {
    process.env.CERT_CLUB_SMOKE_E2E_SEED = "1";
    const list = mockRes();
    await handleGetCertClubCatalog({ url: "/cert-club/catalog" } as IncomingMessage, list);
    assert.equal(list.status, 200);
    const items = JSON.parse(list.body) as {
      data: { items: Array<{ id: string; totalCapacity: number }> };
    };
    assert.equal(items.data.items[0]?.id, CERT_CLUB_SMOKE_TOUR_ID);
    assert.equal(items.data.items[0]?.totalCapacity, 20);

    const detail = mockRes();
    await handleGetCertClubCatalogTour({} as IncomingMessage, detail, CERT_CLUB_SMOKE_TOUR_ID);
    assert.equal(detail.status, 200);
    delete process.env.CERT_CLUB_SMOKE_E2E_SEED;
  });

  it("CW9-04-05 registration accepts party and returns pending operator model", async () => {
    process.env.CERT_CLUB_SMOKE_E2E_SEED = "1";
    const created = mockRes();
    await handlePostCertClubRegistration(
      mockJsonReq({
        tourId: CERT_CLUB_SMOKE_TOUR_ID,
        contact: { fullName: "Ada Guest", email: "ada@example.com" },
        partySize: 2,
      }),
      created
    );
    assert.equal(created.status, 201);
    const parsed = JSON.parse(created.body) as {
      success: boolean;
      data: { tourId: string; status: string };
    };
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.tourId, CERT_CLUB_SMOKE_TOUR_ID);
    assert.equal(parsed.data.status, "pending");
    delete process.env.CERT_CLUB_SMOKE_E2E_SEED;
  });

  it("CW9-04-06 spots remaining — capacity minus accepted is computable from fixture", () => {
    const card = buildCertClubSmokeCatalogCard();
    const accepted = 5;
    const spotsRemaining = card.totalCapacity! - accepted;
    assert.equal(spotsRemaining, 15);
  });

  it("CW9-04-07 transport capability snapshot reader is wired", () => {
    const snapshot = readCertClubCatalogTransportSnapshot({});
    assert.deepEqual(snapshot, { mode: "none" });
  });

  it("CW9-04-08 catalog detail sections enabled via manifest", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPO_ROOT, "packages/workspaces/cert-club/workspace.manifest.json"),
        "utf8"
      )
    );
    const sections = manifest.catalogPresentation?.detailSections;
    assert.equal(sections?.difficulty, true);
    assert.equal(sections?.fitness, true);
    assert.equal(sections?.itinerary, true);
    assert.equal(sections?.policies, true);
  });

  it("CW9-04-09 wizard resume noop — profile-driven without Denali module", () => {
    const audit = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspace-sdk/src/manifest/workspace-wizard-resume-audit.generated.ts"
      ),
      "utf8"
    );
    assert.match(audit, /"cert-club": \{ mode: "noop" \}/);
  });
});
