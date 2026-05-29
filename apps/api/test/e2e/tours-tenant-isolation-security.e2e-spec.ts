import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { DataSource } from "typeorm";
import { assertApiErrorEnvelope } from "@repo/testing-infra";

import { UserRole } from "../../src/common/auth/user-role.enum";
import {
  TourEntity,
  TourLifecycleStatus,
  type TourType,
} from "../../src/modules/tours/entities/tour.entity";
import {
  DifficultyLevel,
  TourDetails,
} from "../../src/modules/tours/entities/tour-details.entity";
import { seedTwoTenantPersonas } from "../helpers/auth-test-personas";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./auth/auth-e2e-harness";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";
import { tenantTestHost } from "./tenant-test-host";

const TENANT_A = "e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3";
const TENANT_B = "f4f4f4f4-f4f4-44f4-84f4-f4f4f4f4f4f4";
const SUBDOMAIN_A = "tours-iso-sec-a";
const SUBDOMAIN_B = "tours-iso-sec-b";
const OWNER_A_PHONE = "+15558220001";
const OWNER_B_PHONE = "+15558220002";
const TENANT_B_TOUR_TITLE = "B Secret Summit";

let ctx: AuthE2eHarnessContext;
let tokenA = "";
let tenantBTourId = "";
let tenantATourId = "";

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth;
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error;
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

async function seedTour(
  ds: DataSource,
  input: {
    tenantId: string;
    title: string;
    tourType: TourType;
    difficulty: DifficultyLevel;
  },
): Promise<string> {
  const tourRepo = ds.getRepository(TourEntity);
  const detailsRepo = ds.getRepository(TourDetails);
  const tour = await tourRepo.save(
    tourRepo.create({
      tenantId: input.tenantId,
      title: input.title,
      description: `${input.title} — confidential tenant payload`,
      totalCapacity: 12,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT,
      tourType: input.tourType,
      transportModes: [],
    }),
  );
  await detailsRepo.save(
    detailsRepo.create({
      tourId: tour.id,
      destinationName: null,
      elevationM: null,
      difficulty: input.difficulty,
      durationDays: null,
      meetingPoint: null,
      itinerary: null,
      tripDetails: null,
    }),
  );
  return tour.id;
}

before(async () => {
  ctx = await createAuthE2eHarness({
    jwtKeys: {
      privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
      publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
    },
    internalApiKey: "test-internal-key-tours-tenant-isolation-security",
    seed: async (ds) => {
      await seedTwoTenantPersonas(ds, {
        tenantA: { id: TENANT_A, subdomain: SUBDOMAIN_A },
        tenantB: { id: TENANT_B, subdomain: SUBDOMAIN_B },
        userInAOnly: {
          phone: OWNER_A_PHONE,
          role: UserRole.Owner,
          fullName: "Tenant A Owner",
        },
        userInBOnly: {
          phone: OWNER_B_PHONE,
          role: UserRole.Owner,
          fullName: "Tenant B Owner",
        },
      });

      tenantATourId = await seedTour(ds, {
        tenantId: TENANT_A,
        title: "A Visible Peak",
        tourType: "mountain",
        difficulty: DifficultyLevel.MODERATE,
      });
      tenantBTourId = await seedTour(ds, {
        tenantId: TENANT_B,
        title: TENANT_B_TOUR_TITLE,
        tourType: "mountain",
        difficulty: DifficultyLevel.HARD,
      });
    },
  });

  if (skip()) return;
  tokenA = await ctx.auth!.loginOtp({
    phone: OWNER_A_PHONE,
    tenantSubdomain: SUBDOMAIN_A,
  });
  assert.equal(ctx.auth!.decodeSessionTenantId(tokenA), TENANT_A.toLowerCase());
});

after(async () => {
  await teardownAuthE2eHarness(ctx);
});

test("GET /api/v2/tours/:id rejects cross-tenant tour id (404, no data leak)", async () => {
  if (skip()) return;

  const response = await request(ctx.app!.getHttpServer())
    .get(`/api/v2/tours/${tenantBTourId}`)
    .set("Host", tenantTestHost(SUBDOMAIN_A))
    .set("Authorization", `Bearer ${tokenA}`);

  assert.ok(
    response.status === 404 || response.status === 403,
    `expected 404 or 403, got ${response.status}`,
  );
  assertApiErrorEnvelope(response.body);
  if (response.status === 404) {
    assert.equal(errorCode(response.body), "RESOURCE_NOT_FOUND");
  }

  const bodyText = JSON.stringify(response.body);
  assert.equal(bodyText.includes(TENANT_B_TOUR_TITLE), false);
  assert.equal(bodyText.includes("confidential tenant payload"), false);
  assert.equal("title" in response.body && typeof response.body.title === "string", false);
  assert.equal(tenantBTourId in response.body, false);
});

test("GET /api/v2/tours/:id returns own-tenant tour when id belongs to session tenant", async () => {
  if (skip()) return;

  const response = await request(ctx.app!.getHttpServer())
    .get(`/api/v2/tours/${tenantATourId}`)
    .set("Host", tenantTestHost(SUBDOMAIN_A))
    .set("Authorization", `Bearer ${tokenA}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.title, "A Visible Peak");
  assert.equal(response.body.id, tenantATourId);
});
