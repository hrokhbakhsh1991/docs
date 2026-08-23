import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { configureUrbanHttpHost, resetUrbanHttpHostForTests } from "../src/http/host-runtime";
import { UrbanRegistrationDuplicateError } from "../src/http/errors/urban-registration-conflict.error";
import type { UrbanTourStorePort } from "../src/http/ports/tour-store.port";
import {
  InMemoryUrbanRegistrationRepository,
} from "../src/http/registration.repository";
import { createUrbanRegistration } from "../src/http/registration.service";
import { URBAN_WORKSPACE_TYPE } from "../src/urban.plugin";

const tourId = "00000000-0000-4000-8000-000000000701";
const tenantId = "00000000-0000-4000-8000-000000000702";

const publishedCanonical = {
  schemaVersion: 1,
  roots: ["tour"],
  data: {
    tour: {
      title: "Urban duplicate contract tour",
      publishStatus: "published",
      capacity: 50,
    },
  },
} as CanonicalDocument;

function tourStore(): UrbanTourStorePort {
  return {
    findFirst: async ({ id }) =>
      id === tourId
        ? { id: tourId, createdAt: "2026-08-01T00:00:00.000Z", canonical: publishedCanonical }
        : null,
    listPage: async () => ({ items: [] }),
  };
}

describe("urban-duplicate-protection.contract (CW4-07)", () => {
  it("CW4-07-U01 duplicate email on same tour throws URBAN_REGISTRATION_DUPLICATE", async () => {
    resetUrbanHttpHostForTests();
    configureUrbanHttpHost({
      resolveTenantContextFromRequest: async () => ({
        tenantId,
        workspaceType: URBAN_WORKSPACE_TYPE,
      }),
      readUrbanSettingsRequestBody: async () => ({}),
      readUrbanRegistrationRequestBody: async () => ({}),
      resolveTourStore: async () => tourStore(),
      resolveExposureResolverPort: () => undefined,
      settings: {
        resolveTenantThemeJsonById: async () => ({}),
        persistTenantTheme: async () => undefined,
        requireActiveTraceId: () => "trace-urban-dup",
      },
      registration: {
        assertPublicRegistrationThrottle: async () => undefined,
        readIdempotencyKey: () => "idem-key",
        hashIdempotentRequest: () => "hash",
        runIdempotentHttpMutation: async (_t, _k, _h, finish) => finish(),
        idempotencyKeyRequiredCode: "IDEMPOTENCY_KEY_REQUIRED",
        decideRegistrationStatus: () => "confirmed",
      },
    });

    const repo = new InMemoryUrbanRegistrationRepository();
    const body = {
      tourId,
      contact: { email: "dup@urban.example", fullName: "Dup Guest" },
      partySize: 1,
    };

    const first = await createUrbanRegistration({
      tenantId,
      workspaceType: URBAN_WORKSPACE_TYPE,
      body,
      store: tourStore(),
      registrationRepo: repo,
    });
    assert.equal(first.status, "confirmed");

    await assert.rejects(
      () =>
        createUrbanRegistration({
          tenantId,
          workspaceType: URBAN_WORKSPACE_TYPE,
          body,
          store: tourStore(),
          registrationRepo: repo,
        }),
      UrbanRegistrationDuplicateError
    );
  });

  it("CW4-07-U02 negative: Urban service does not import BookingPublicPort probe kinds", () => {
    const serviceSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/http/registration.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(serviceSrc, /BookingPublicPort/);
    assert.doesNotMatch(serviceSrc, /findDuplicateByTour/);
    assert.doesNotMatch(serviceSrc, /BOOKING_GUEST_DUPLICATE/);
    assert.match(serviceSrc, /findByTenantTourEmail/);
  });

  it("CW4-07-U03 negative: Urban email key is not booking multi-probe model", () => {
    const schema = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../../apps/api/prisma/schema.prisma"),
      "utf8"
    );
    assert.match(schema, /@@unique\(\[tenantId, tourId, email\], map: "uq_urban_reg_tenant_tour_email"\)/);
    assert.doesNotMatch(schema, /model UrbanRegistration[\s\S]*registrantTarget/);
  });
});
