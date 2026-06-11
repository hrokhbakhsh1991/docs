/**
 * Denali public registration HTTP (M16)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

function publicHeaders(tenantId = OPERATOR_SMOKE_TENANT_ID): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "content-type": "application/json",
  };
}

async function requestDenali(
  listener: ReturnType<typeof createRequestListener>,
  method: "GET" | "POST",
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
  });

  it("DREG-16-01 POST /denali/registrations creates pending booking", async () => {
    const response = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: publicHeaders(),
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { email: "denali.guest@example.com", fullName: "Denali Guest" },
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
        "x-user-id": "00000000-0000-4000-8000-000000000103",
        "x-actor-role": "member",
        "x-membership-status": "ACTIVE",
        "content-type": "application/json",
      },
      body: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: { email: "denali.session@example.com", fullName: "Session Guest" },
        partySize: 2,
      },
    });
    assert.equal(response.status, 201);
  });

  it("DREG-16-02 POST /denali/registrations duplicate email returns 409", async () => {
    const body = {
      tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
      contact: { email: "denali.dup@example.com", fullName: "Dup Guest" },
      partySize: 1,
    };
    const first = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: publicHeaders(),
      body,
    });
    assert.equal(first.status, 201);
    const second = await requestDenali(listener, "POST", "/denali/registrations", {
      headers: publicHeaders(),
      body,
    });
    assert.equal(second.status, 409);
    assert.equal((second.body as { code?: string }).code, "DENALI_REGISTRATION_DUPLICATE");
  });
});
