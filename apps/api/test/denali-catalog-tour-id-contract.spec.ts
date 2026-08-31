/**
 * B4.2 — Denali catalog tour detail ID contract (B4.1).
 * Malformed tour ids must map to 404; unexpected store failures stay 500.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { Prisma } from "@prisma/client";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import type { TourStorageRepository } from "../src/storage/tour-storage.interface";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const MISSING_PUBLISHED_SHAPE_TOUR_ID = "00000000-0000-4000-8000-000000009999";

const TOUR_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicHeaders(tenantId = OPERATOR_SMOKE_TENANT_ID): Record<string, string> {
  return { "x-tenant-id": tenantId };
}

async function requestDenali(
  listener: ReturnType<typeof createRequestListener>,
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
          method: "GET",
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

function postgresInvalidTourIdError(tourId: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    `invalid input syntax for type uuid: "${tourId}"`,
    { code: "P2023", clientVersion: "test" }
  );
}

function wrapPostgresLikeTourStore(inner: InMemoryTourRepository): TourStorageRepository {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === "getById") {
        return async (id: string, tenantId: string) => {
          if (!TOUR_UUID_PATTERN.test(id.trim())) {
            throw postgresInvalidTourIdError(id);
          }
          return inner.getById(id, tenantId);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as TourStorageRepository;
}

function wrapUnavailableTourStore(inner: InMemoryTourRepository): TourStorageRepository {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === "getById") {
        return async () => {
          throw new Error("SIMULATED_STORE_UNAVAILABLE");
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as TourStorageRepository;
}

installMemoryStorageDriverForDescribe();

describe("denali-catalog-tour-id-contract — B4.2", () => {
  let seededStore: InMemoryTourRepository;
  let seededListener: ReturnType<typeof createRequestListener>;
  let postgresLikeListener: ReturnType<typeof createRequestListener>;
  let unavailableListener: ReturnType<typeof createRequestListener>;

  before(() => {
    seededStore = new InMemoryTourRepository();
    seededStore.ensureOperatorSmokeSeedTour();
    const toursService = createTestToursService(seededStore);
    seededListener = createRequestListener({ toursService, tourStore: seededStore });

    const postgresLikeStore = wrapPostgresLikeTourStore(seededStore);
    postgresLikeListener = createRequestListener({
      toursService: createTestToursService(postgresLikeStore),
      tourStore: postgresLikeStore,
    });

    const unavailableStore = wrapUnavailableTourStore(seededStore);
    unavailableListener = createRequestListener({
      toursService: createTestToursService(unavailableStore),
      tourStore: unavailableStore,
    });
  });

  it("B4-01 published tour UUID returns catalog card payload", async () => {
    const response = await requestDenali(
      seededListener,
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 200);
    const data = (response.body as { success?: boolean; data?: { id?: string; title?: string } })
      .data;
    assert.equal(data?.id, OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
    assert.equal(data?.title, "North Ridge Trek");
  });

  it("B4-02 valid missing tour UUID returns 404 NOT_FOUND", async () => {
    const response = await requestDenali(
      seededListener,
      `/denali/catalog/${MISSING_PUBLISHED_SHAPE_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 404);
    assert.equal((response.body as { code?: string }).code, "NOT_FOUND");
  });

  it("B4-03 malformed tour id returns 404 (not 500) when store rejects invalid UUID", async () => {
    const response = await requestDenali(postgresLikeListener, "/denali/catalog/tour-abc", {
      headers: publicHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal((response.body as { code?: string }).code, "NOT_FOUND");
  });

  it("B4-04 unexpected store failure remains 500 internal_error", async () => {
    const response = await requestDenali(
      unavailableListener,
      `/denali/catalog/${OPERATOR_SMOKE_PUBLISHED_TOUR_ID}`,
      { headers: publicHeaders() }
    );
    assert.equal(response.status, 500);
    assert.equal((response.body as { error?: string }).error, "internal_error");
  });
});
