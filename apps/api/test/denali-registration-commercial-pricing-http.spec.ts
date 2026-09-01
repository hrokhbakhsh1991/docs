/**
 * Denali owned registration + member receipt commercial pricing HTTP (CQ-DISPLAY).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import "../src/http/configure-product-http-hosts.ts";
import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { InMemoryIdentityRepository } from "../src/identity/in-memory-identity.repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { createTourStorageRepository } from "../src/storage/create-tour-storage";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const TENANT = "00000000-0000-4000-8000-000000000014";
const TOUR_ID = "00000000-0000-4000-8000-000000000210";
const MEMBER_USER = "00000000-0000-4000-8000-000000000114";

async function requestApi(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);

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
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

function memberHeaders(userId = MEMBER_USER, workspaceId = "ws-dreg-cq"): Record<string, string> {
  return {
    "x-tenant-id": TENANT,
    "x-authenticated-tenant-id": TENANT,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": workspaceId,
    "content-type": "application/json",
  };
}

async function patchTourForMembershipDiscount(repo: InMemoryTourRepository): Promise<void> {
  const tour = await repo.getById(TOUR_ID, TENANT);
  if (tour === null) {
    throw new Error(`tour ${TOUR_ID} missing`);
  }
  const canonical = tour.canonical as {
    readonly schemaVersion: number;
    readonly roots: readonly string[];
    readonly data: Record<string, unknown>;
  };
  const data = { ...canonical.data };
  const pricing =
    data.pricing !== null && typeof data.pricing === "object"
      ? { ...(data.pricing as Record<string, unknown>) }
      : {};
  pricing.basePricePerPerson = 10_000_000;
  pricing.allowMembershipDiscount = true;
  pricing.paymentMode = "offline_receipt";
  data.pricing = pricing;
  await repo.updateIfRowVersion({
    tenantId: TENANT,
    id: TOUR_ID,
    expectedRowVersion: tour.rowVersion,
    canonical: {
      schemaVersion: canonical.schemaVersion,
      roots: [...canonical.roots],
      data,
    },
  });
}

describe("denali-registration-commercial-pricing-http", () => {
  installMemoryStorageDriverForDescribe();
  let listener: ReturnType<typeof createRequestListener>;
  let tourRepo: InMemoryTourRepository;

  before(async () => {
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    const store = createTourStorageRepository();
    if (!(store instanceof InMemoryTourRepository)) {
      throw new Error("denali-registration-commercial-pricing-http requires in-memory tours");
    }
    tourRepo = store;
    tourRepo.ensureOperatorSmokeSeedTour();
    const toursService = createTestToursService(tourRepo);
    listener = createRequestListener({ toursService, tourStore: tourRepo });

    const identity = getIdentityRepository();
    if (!(identity instanceof InMemoryIdentityRepository)) {
      throw new Error("denali-registration-commercial-pricing-http requires in-memory identity");
    }
    identity.seedUser({ id: MEMBER_USER, mobile: "+15550001014" });
    identity.seedMembership({
      userId: MEMBER_USER,
      tenantId: TENANT,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-dreg-cq",
      displayName: "CQ Display Member",
      rewards: { permanentDiscountPercentage: 50 },
    });
    await patchTourForMembershipDiscount(tourRepo);
  });

  it("DN-CQ-HTTP-01 owned registration detail exposes commercial pricing at 5M", async () => {
    const created = await requestApi(listener, "POST", "/denali/registrations", {
      headers: memberHeaders(),
      body: {
        tourId: TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "CQ Display Member" },
        partySize: 1,
        transport: { kind: "primary" },
      },
    });
    assert.equal(created.status, 201);
    const registrationId = (created.body as { data?: { id?: string } }).data?.id;
    assert.ok(typeof registrationId === "string" && registrationId.length > 0);

    const detail = await requestApi(listener, "GET", `/denali/registrations/${registrationId}`, {
      headers: memberHeaders(),
    });
    assert.equal(detail.status, 200);
    const data = (detail.body as { data?: Record<string, unknown> }).data;
    assert.equal(data?.dueTotalMinor, "5000000");
    const commercialPricing = data?.commercialPricing as Record<string, unknown> | undefined;
    assert.ok(commercialPricing);
    assert.equal(commercialPricing.grossMinor, "10000000");
    assert.equal(commercialPricing.memberDiscountMinor, "5000000");
    assert.equal(commercialPricing.payableMinor, "5000000");
  });
});
