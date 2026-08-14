/**
 * Denali public registration HTTP (M16)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getBookingsRepository } from "../src/bookings/create-bookings-repository";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { InMemoryIdentityRepository } from "../src/identity/in-memory-identity.repository";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

/** Self-registration members — not the smoke fixture member (…103 already has pending on …210). */
const DREG_SESSION_MEMBER_A = "00000000-0000-4000-8000-000000000104";
const DREG_SESSION_MEMBER_B = "00000000-0000-4000-8000-000000000105";

function publicHeaders(tenantId = OPERATOR_SMOKE_TENANT_ID): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "content-type": "application/json",
  };
}

function seedDenaliRegistrationSessionMembers(): void {
  const identity = getIdentityRepository();
  if (!(identity instanceof InMemoryIdentityRepository)) {
    throw new Error("denali-registration.spec requires in-memory identity");
  }
  for (const [userId, mobile, displayName] of [
    [DREG_SESSION_MEMBER_A, "+15550001004", "DREG Session A"],
    [DREG_SESSION_MEMBER_B, "+15550001005", "DREG Session B"],
    ["00000000-0000-4000-8000-000000000106", "+15550001006", "DREG Other A"],
    ["00000000-0000-4000-8000-000000000107", "+15550001007", "DREG Other B"],
    ["00000000-0000-4000-8000-000000000108", "+15550001008", "DREG Other C"],
    ["00000000-0000-4000-8000-000000000109", "+15550001009", "DREG Self Other"],
    ["00000000-0000-4000-8000-000000000110", "+15550001010", "DREG For Tour"],
    ["00000000-0000-4000-8000-000000000111", "+15550001011", "DREG Amend"],
    ["00000000-0000-4000-8000-000000000112", "+15550001012", "DREG Get By Id"],
    ["00000000-0000-4000-8000-000000000113", "+15550001013", "DREG Reclassify"],
  ] as const) {
    identity.seedUser({ id: userId, mobile });
    identity.seedMembership({
      userId,
      tenantId: OPERATOR_SMOKE_TENANT_ID,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: `ws-dreg-${userId.slice(-4)}`,
      displayName,
    });
  }
}

async function requestDenali(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST" | "PATCH",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
): Promise<{ status: number; body: unknown }> {
  const payload =
    options?.body === undefined ? undefined : JSON.stringify(options.body);

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

describe("denali-registration (M16)", () => {
  installMemoryStorageDriverForDescribe();

  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    const repo = new InMemoryTourRepository();
    repo.ensureOperatorSmokeSeedTour();
    const toursService = createTestToursService(repo);
    listener = createRequestListener({ toursService, tourStore: repo });
    seedDenaliRegistrationSessionMembers();
  });

  it("DREG-16-01 POST /denali/registrations creates pending booking", async () => {
    const response = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { fullName: "Denali Guest" },
        partySize: 2,
      },
    });
    if (response.status !== 201) {
      console.error("DREG-16-01 body", response.body);
    }
    assert.equal(response.status, 201);
    const data = (response.body as { data?: { id?: string; status?: string } }).data;
    assert.ok(data?.id);
    assert.equal(data?.status, "pending");
  });

  it("DREG-17-01 POST /denali/registrations accepts M17 session member user id", async () => {
    const response = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: {
        "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-user-id": DREG_SESSION_MEMBER_A,
        "x-actor-role": "member",
        "x-membership-status": "ACTIVE",
        "content-type": "application/json",
      },
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { fullName: "Session Guest" },
        partySize: 2,
      },
    });
    assert.equal(response.status, 201);
  });

  it("DREG-16-02 POST /denali/registrations duplicate member returns 409", async () => {
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": DREG_SESSION_MEMBER_B,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const body = {
      tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
      contact: { fullName: "Dup Guest" },
      partySize: 1,
    };
    const first = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body,
    });
    assert.equal(second.status, 409);
    assert.equal((second.body as { code?: string }).code, "DENALI_REGISTRATION_DUPLICATE");
  });

  it("DREG-18-01 other registrant allows same booker with different guest names", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000106";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const first = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "other",
        contact: { fullName: "Guest One", phone: "+15550001006" },
        partySize: 1,
      },
    });
    assert.equal(first.status, 201);
    const second = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "other",
        contact: { fullName: "Guest Two", phone: "+15550001012" },
        partySize: 1,
      },
    });
    assert.equal(second.status, 201);
  });

  it("DREG-18-04 self then other by same booker succeeds", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000109";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const selfReg = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "Self Member" },
        partySize: 1,
      },
    });
    assert.equal(selfReg.status, 201);
    const otherReg = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "other",
        contact: { fullName: "Other Guest After Self", phone: "+15550001009" },
        partySize: 1,
      },
    });
    assert.equal(otherReg.status, 201);
  });

  it("DREG-18-08 other then self with same nationalId reclassifies owned other", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000113";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const nationalId = "4420457521";
    const otherReg = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "other",
        contact: {
          fullName: "Mistaken Other Self",
          phone: "+15550001013",
          nationalId,
        },
        partySize: 1,
      },
    });
    assert.equal(otherReg.status, 201);
    const otherBody = otherReg.body as { data?: { id?: string } };
    const otherId = otherBody.data?.id;
    assert.equal(typeof otherId, "string");

    const selfReg = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "DREG Reclassify", nationalId },
        partySize: 1,
      },
    });
    assert.equal(selfReg.status, 201);
    const selfBody = selfReg.body as { data?: { id?: string } };
    assert.equal(selfBody.data?.id, otherId);

    const forTour = await requestDenali(
      listener,
      "GET",
      `/denali/registrations/for-tour/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: sessionHeaders }
    );
    assert.equal(forTour.status, 200);
    const forTourBody = forTour.body as {
      data?: { self?: { id?: string } | null };
    };
    assert.equal(forTourBody.data?.self?.id, otherId);

    const detail = await requestDenali(
      listener,
      "GET",
      `/denali/registrations/${otherId}`,
      { headers: sessionHeaders }
    );
    assert.equal(detail.status, 200);
    const detailBody = detail.body as {
      data?: { registrantTarget?: string; guestLabel?: string };
    };
    assert.equal(detailBody.data?.registrantTarget, "self");
    assert.equal(detailBody.data?.guestLabel, "DREG Reclassify");
  });

  it("DREG-18-05 GET for-tour returns self after self registration", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000110";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const created = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "For Tour Gate" },
        partySize: 1,
      },
    });
    assert.equal(created.status, 201);
    const createdId = (created.body as { data?: { id?: string } }).data?.id;
    assert.ok(typeof createdId === "string" && createdId.length > 0);
    const forTour = await requestDenali(
      listener,
      "GET",
      `/denali/registrations/for-tour/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: sessionHeaders }
    );
    assert.equal(forTour.status, 200);
    const self = (forTour.body as { data?: { self?: { id?: string } | null } }).data?.self;
    assert.equal(self?.id, createdId);
  });

  it("DREG-18-07 GET registration by id returns owned detail", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000112";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const created = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "Get By Id Member" },
        partySize: 1,
      },
    });
    assert.equal(created.status, 201);
    const createdId = (created.body as { data?: { id?: string } }).data?.id;
    assert.ok(typeof createdId === "string" && createdId.length > 0);
    const detail = await requestDenali(listener, "GET", `/denali/registrations/${createdId}`, {
      headers: sessionHeaders,
    });
    assert.equal(detail.status, 200);
    const data = (detail.body as { data?: { id?: string; status?: string; tourId?: string } }).data;
    assert.equal(data?.id, createdId);
    assert.equal(data?.tourId, OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.ok(typeof data?.status === "string" && data.status.length > 0);
  });

  it("DREG-18-06 PATCH pending registration transport succeeds", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000111";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const created = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "self",
        contact: { fullName: "Amend Transport Member" },
        partySize: 1,
      },
    });
    assert.equal(created.status, 201);
    const createdId = (created.body as { data?: { id?: string } }).data?.id;
    assert.ok(typeof createdId === "string" && createdId.length > 0);
    const patched = await requestDenali(
      listener,
      "PATCH",
      `/denali/registrations/${createdId}`,
      {
        headers: sessionHeaders,
        body: { transport: { kind: "primary" } },
      }
    );
    assert.equal(patched.status, 200);
    assert.equal((patched.body as { data?: { id?: string } }).data?.id, createdId);
  });

  it("DREG-18-02 other registrant duplicate guest name returns 409", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000107";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const body = {
      tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
      registrantTarget: "other",
      contact: { fullName: "Duplicate Guest", phone: "+15550001007" },
      partySize: 1,
    };
    const first = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body,
    });
    assert.equal(second.status, 409);
  });

  it("DREG-18-03 other registrant duplicate national id returns 409", async () => {
    const memberUserId = "00000000-0000-4000-8000-000000000108";
    const sessionHeaders = {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": memberUserId,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "content-type": "application/json",
    };
    const firstBody = {
      tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
      registrantTarget: "other",
      contact: { fullName: "Guest Alpha", nationalId: "1234567890", phone: "+15550001008" },
      partySize: 1,
    };
    const first = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: firstBody,
    });
    assert.equal(first.status, 201);
    const second = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: sessionHeaders,
      body: {
        ...firstBody,
        contact: { fullName: "Guest Beta", nationalId: "1234567890", phone: "+15550001008" },
      },
    });
    assert.equal(second.status, 409);
  });

  it("DREG-19-01 POST persists registrationIntake on booking", async () => {
    const response = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        registrantTarget: "other",
        contact: {
          fullName: "Intake Guest",
          nationalId: "9876543210",
          phone: "09121234568",
        },
        partySize: 2,
        transport: { kind: "primary" },
      },
    });
    assert.equal(response.status, 201);
    const bookingId = (response.body as { data?: { id?: string } }).data?.id;
    assert.ok(bookingId);

    const booking = await getBookingsRepository().getById(bookingId!, OPERATOR_SMOKE_TENANT_ID);
    assert.ok(booking);
    const intake = booking!.registrationIntake as Record<string, unknown> | undefined;
    assert.ok(intake);
    assert.equal(intake!.registrantTarget, "other");
    assert.deepEqual(intake!.transport, { kind: "primary" });
    assert.equal(intake!.nationalId, "9876543210");
  });
});
