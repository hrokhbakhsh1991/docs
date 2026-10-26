/**
 * P6 — member receipt binary upload through the booking HTTP route (memory storage).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { before, after, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  deleteMemberReceiptProof,
  readMemoryReceiptProof,
} from "../src/workspace-finance/receipt-proof-storage";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import {
  createSharedMemoryTourStoreForHttpTests,
  createTestToursService,
  installMemoryStorageDriverForDescribe,
} from "./test-helpers";

installMemoryStorageDriverForDescribe();

const tourStore = createSharedMemoryTourStoreForHttpTests();
const listener = createRequestListener({
  toursService: createTestToursService(tourStore),
  tourStore,
});
const client = installHttpTestClient(() => listener);
let binaryServer: http.Server;
let binaryPort = 0;

describe("p6-member-receipt-binary", () => {
  let tourId = "";

  before(async () => {
    seedOperatorIdentityFixture();
    binaryServer = http.createServer(listener);
    await new Promise<void>((resolve, reject) => {
      binaryServer.once("error", reject);
      binaryServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = binaryServer.address();
    assert.ok(address && typeof address !== "string");
    binaryPort = address.port;

    const sourceTour = await tourStore.getById(OPERATOR_SMOKE.seedTourId, OPERATOR_SMOKE.tenantId);
    assert.ok(sourceTour, "isolated source tour fixture must exist");
    tourId = randomUUID();
    const title = `P6 binary receipt ${randomUUID().slice(0, 8)}`;
    const data = structuredClone(sourceTour.canonical.data) as Record<string, unknown>;
    const basics =
      data.basics !== null && typeof data.basics === "object" && !Array.isArray(data.basics)
        ? (data.basics as Record<string, unknown>)
        : {};
    const pricing =
      data.pricing !== null && typeof data.pricing === "object" && !Array.isArray(data.pricing)
        ? (data.pricing as Record<string, unknown>)
        : {};
    data.title = title;
    data.basics = { ...basics, title };
    data.capacityMax = 2;
    data.pricing = {
      ...pricing,
      paymentCollection: "offline",
      registrationApproval: "manual",
    };
    await tourStore.save({
      ...sourceTour,
      id: tourId,
      createdAt: new Date().toISOString(),
      rowVersion: 1,
      canonical: { ...sourceTour.canonical, data },
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      binaryServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("stores the actual uploaded image bytes and exposes the pending image receipt", async () => {
    const guestSuffix = randomUUID().replaceAll("-", "").slice(0, 7);
    const mobile = `+1555${guestSuffix}`;
    const email = `p6-binary-${randomUUID()}@denali-smoke.local`;
    const { user, membership } = await getIdentityRepository().registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile,
      displayName: "P6 Binary Receipt Guest",
      email,
    });
    const workspaceId = membership.workspaceId ?? `ws-p6-binary-${user.id}`;
    const member = memberHeaders(user.id, workspaceId);

    const registration = await client.requestJson<{ data?: { id?: string } }>(
      "POST",
      "/denali/registrations",
      {
        headers: member,
        body: {
          tourId,
          contact: { email, fullName: "P6 Binary Receipt Guest" },
          partySize: 1,
        },
      }
    );
    assert.equal(registration.status, 201);
    const bookingId = registration.body.data?.id ?? "";
    assert.ok(bookingId.length > 0);

    const approval = await client.requestJson<{ status?: string }>(
      "POST",
      `/bookings/${bookingId}/approve`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(approval.status, 200);
    assert.equal(approval.body.status, "approved");

    // A tiny valid 1x1 PNG, used only in this isolated test fixture.
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l0cAAAAASUVORK5CYII=",
      "base64"
    );
    const response = await requestBinaryReceipt({
      port: binaryPort,
      path: `/bookings/${bookingId}/receipts`,
      headers: {
        ...member,
        "content-type": "image/png",
        "content-length": String(imageBytes.length),
        "x-receipt-file-name": "synthetic-receipt.png",
      },
      body: imageBytes,
    });
    assert.equal(response.status, 201, response.body.toString("utf8"));
    const receipt = JSON.parse(response.body.toString("utf8")) as {
      fileKey?: string | null;
      status?: string;
    };
    assert.equal(receipt.status, "Pending");
    assert.ok(receipt.fileKey);

    const storedBytes = readMemoryReceiptProof(receipt.fileKey);
    assert.ok(storedBytes, "uploaded image must be present in the memory receipt store");
    assert.deepEqual(storedBytes, imageBytes);

    const status = await client.requestJson<{ status?: string; previewKind?: string | null }>(
      "GET",
      `/bookings/${bookingId}/receipts`,
      { headers: member }
    );
    assert.equal(status.status, 200);
    assert.equal(status.body.status, "pending");
    assert.equal(status.body.previewKind, "image");

    await deleteMemberReceiptProof({
      tenantId: OPERATOR_SMOKE.tenantId,
      storageKey: receipt.fileKey,
    });
  });
});

function requestBinaryReceipt(input: {
  port: number;
  path: string;
  headers: Record<string, string>;
  body: Buffer;
}): Promise<{ status: number; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: input.port,
        path: input.path,
        method: "POST",
        headers: input.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk as Buffer));
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) });
        });
      }
    );
    request.on("error", reject);
    request.end(input.body);
  });
}

function memberHeaders(userId: string, workspaceId: string): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": workspaceId,
    "content-type": "application/json",
  };
}
