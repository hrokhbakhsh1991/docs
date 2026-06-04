import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import { ToursService } from "../src/tours/tours.service";
const TENANT_A_ID = "00000000-0000-4000-8000-000000000001";

function listen(handler: ReturnType<typeof createRequestListener>) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const req = {
      method: "GET",
      url: "/api/v2/tenant-config",
      headers: {
        host: "tenant-a.localhost:3001",
        "x-authenticated-tenant-id": TENANT_A_ID,
        "x-tenant-id": TENANT_A_ID,
        "x-user-id": "u1",
        "x-workspace-id": "ws-1",
        "x-actor-role": "admin",
        "x-membership-status": "ACTIVE",
      },
    } as import("node:http").IncomingMessage;

    const chunks: Buffer[] = [];
    const res = {
      statusCode: 200,
      setHeader() {},
      end(chunk: Buffer | string) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: JSON.parse(text) as unknown });
      },
    } as import("node:http").ServerResponse;

    void handler(req, res).catch(reject);
  });
}

describe("GET /api/v2/tenant-config", () => {
  it("returns tenant-a theme for matching host and auth", async () => {
    const store = new TourStorageDbAdapter(new InMemoryTourRepository());
    const toursService = new ToursService(
      new CanonicalTourService(store, new LegacyCanonicalAdapter()),
    );
    const handler = createRequestListener({ toursService });

    const { status, body } = await listen(handler);
    assert.equal(status, 200);
    assert.equal(
      (body as { theme?: { primaryColor?: string } }).theme?.primaryColor,
      "#2563eb",
    );
  });
});
