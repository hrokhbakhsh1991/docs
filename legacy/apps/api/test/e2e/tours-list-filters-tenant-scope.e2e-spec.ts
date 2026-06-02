import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { DataSource } from "typeorm";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { TourEntity, TourLifecycleStatus, type TourType } from "../../src/modules/tours/entities/tour.entity";
import { DifficultyLevel, TourDetails } from "../../src/modules/tours/entities/tour-details.entity";
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

const TENANT_A = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";
const TENANT_B = "d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2";
const SUBDOMAIN_A = "tours-filter-a";
const SUBDOMAIN_B = "tours-filter-b";
const OWNER_A_PHONE = "+15558110001";
const OWNER_B_PHONE = "+15558110002";

let ctx: AuthE2eHarnessContext;
let tokenA = "";

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth;
}

function sortedTitles(items: Array<{ title: string }>): string[] {
  return items.map((item) => item.title).sort();
}

async function seedTour(
  ds: DataSource,
  input: {
    tenantId: string;
    title: string;
    tourType: TourType;
    difficulty: DifficultyLevel;
  },
): Promise<void> {
  const tourRepo = ds.getRepository(TourEntity);
  const detailsRepo = ds.getRepository(TourDetails);
  const tour = await tourRepo.save(
    tourRepo.create({
      tenantId: input.tenantId,
      title: input.title,
      description: `${input.title} description`,
      totalCapacity: 12,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT,
      tourType: input.tourType,
      transportModes: [],
    }),
  );
  await detailsRepo.save(
    detailsRepo.create({
      tenantId: input.tenantId,
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
}

before(async () => {
  ctx = await createAuthE2eHarness({
    jwtKeys: {
      privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
      publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
    },
    internalApiKey: "test-internal-key-tours-list-filters-scope",
    seed: async (ds) => {
      await seedTwoTenantPersonas(ds, {
        tenantA: { id: TENANT_A, subdomain: SUBDOMAIN_A },
        tenantB: { id: TENANT_B, subdomain: SUBDOMAIN_B },
        userInAOnly: {
          phone: OWNER_A_PHONE,
          subdomain: SUBDOMAIN_A,
          role: UserRole.Owner,
          fullName: "Tenant A Owner",
        },
        userInBOnly: {
          phone: OWNER_B_PHONE,
          subdomain: SUBDOMAIN_B,
          role: UserRole.Owner,
          fullName: "Tenant B Owner",
        },
      });

      await seedTour(ds, {
        tenantId: TENANT_A,
        title: "A Hard Mountain",
        tourType: "mountain",
        difficulty: DifficultyLevel.HARD,
      });
      await seedTour(ds, {
        tenantId: TENANT_A,
        title: "A Easy Nature",
        tourType: "nature",
        difficulty: DifficultyLevel.EASY,
      });
      await seedTour(ds, {
        tenantId: TENANT_B,
        title: "B Hard Mountain",
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
});

after(async () => {
  await teardownAuthE2eHarness(ctx);
});

test("GET /api/v2/tours difficulty filter stays within authenticated tenant", async () => {
  if (skip()) return;
  const response = await request(ctx.app!.getHttpServer())
    .get("/api/v2/tours")
    .query({ difficulty: "hard", sort_by: "difficulty", sort_dir: "asc" })
    .set("Host", tenantTestHost(SUBDOMAIN_A))
    .set("Authorization", `Bearer ${tokenA}`);

  assert.equal(response.status, 200);
  const items = response.body.items as Array<{
    title: string;
    difficulty?: string;
    tourType?: string;
  }>;
  assert.equal(items.length, 1);
  assert.deepEqual(sortedTitles(items), ["A Hard Mountain"]);
  assert.equal(items.every((item) => item.title.startsWith("A ")), true);
  assert.equal(items.some((item) => item.title.startsWith("B ")), false);
});

test("GET /api/v2/tours category filter excludes identical category from other tenant", async () => {
  if (skip()) return;
  const response = await request(ctx.app!.getHttpServer())
    .get("/api/v2/tours")
    .query({ category: "mountain", sort_by: "category", sort_dir: "asc" })
    .set("Host", tenantTestHost(SUBDOMAIN_A))
    .set("Authorization", `Bearer ${tokenA}`);

  assert.equal(response.status, 200);
  const items = response.body.items as Array<{ title: string; tourType?: string }>;
  assert.equal(items.length, 1);
  assert.deepEqual(sortedTitles(items), ["A Hard Mountain"]);
  assert.equal(items.every((item) => item.title.startsWith("A ")), true);
  assert.equal(items.some((item) => item.title.startsWith("B ")), false);
});

