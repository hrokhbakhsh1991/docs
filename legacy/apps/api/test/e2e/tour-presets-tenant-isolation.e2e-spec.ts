import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SLUG_A = "preset-iso-a";
const SLUG_B = "preset-iso-b";
const OWNER_A_PHONE = "+15558200001";
const OWNER_B_PHONE = "+15558200002";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenA = "";
let tokenB = "";

function applyEnvForContainer(db: StartedPostgreSqlContainer): void {
  process.env.NODE_ENV = "test";
  assignTestApiPort();
  process.env.LOG_LEVEL = "error";
  process.env.DATABASE_HOST = db.getHost();
  process.env.DATABASE_PORT = String(db.getPort());
  process.env.DATABASE_USER = db.getUsername();
  process.env.DATABASE_PASSWORD = db.getPassword();
  process.env.DATABASE_NAME = db.getDatabase();
  process.env.DATABASE_URL = db.getConnectionUri();
  process.env.JWT_PRIVATE_KEY = E2E_JWT_PRIVATE_KEY_PKCS8;
  process.env.JWT_PUBLIC_KEY = E2E_JWT_PUBLIC_KEY_SPKI;
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "test-issuer";
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "test-audience";
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const hash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    { id: TENANT_A, name: "Preset ISO A", description: "a", subdomain: SLUG_A },
    { id: TENANT_B, name: "Preset ISO B", description: "b", subdomain: SLUG_B },
  ]);

  const ownerA = await userRepo.save(
    userRepo.create({
      email: "owner-a@preset-iso.test",
      phone: OWNER_A_PHONE,
      isPhoneVerified: true,
      hashedPassword: hash,
      fullName: "Owner A",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  const ownerB = await userRepo.save(
    userRepo.create({
      email: "owner-b@preset-iso.test",
      phone: OWNER_B_PHONE,
      isPhoneVerified: true,
      hashedPassword: hash,
      fullName: "Owner B",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: ownerA.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: ownerB.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
    }),
  ]);
}

before(async () => {
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
  } catch (error: unknown) {
    e2eUnavailableReason = `testcontainers unavailable: ${String(error)}`;
    return;
  }
  applyEnvForContainer(container);
  await resetTestDatabaseWithMigrations();
  app = await createE2EApp();
  await seed(app.get(DataSource));
  tokenA = await webSessionOtpToken(app, { phone: OWNER_A_PHONE, tenantSubdomain: SLUG_A });
  tokenB = await webSessionOtpToken(app, { phone: OWNER_B_PHONE, tenantSubdomain: SLUG_B });
});

after(async () => {
  if (app) await app.close();
  if (container) await container.stop();
});

test("tenant B cannot PATCH preset created in tenant A (404)", async () => {
  if (e2eUnavailableReason || !app) return;

  const hostA = tenantTestHost(SLUG_A);
  const hostB = tenantTestHost(SLUG_B);

  const created = await request(app.getHttpServer())
    .post("/api/v2/settings/tour-presets")
    .set("Host", hostA)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      name: "Preset A only",
      formProfile: "general",
      defaults: { overview: { tourType: "mountain" } },
    })
    .expect(201);

  const presetId = created.body.id as string;
  assert.ok(presetId);

  const patch = await request(app.getHttpServer())
    .patch(`/api/v2/settings/tour-presets/${presetId}`)
    .set("Host", hostB)
    .set("Authorization", `Bearer ${tokenB}`)
    .send({ name: "Hijack" });

  assert.equal(patch.status, 404);
  assert.equal(patch.body?.error?.code, "RESOURCE_NOT_FOUND");
});

test("tenant B list does not include tenant A preset id", async () => {
  if (e2eUnavailableReason || !app) return;

  const hostA = tenantTestHost(SLUG_A);
  const hostB = tenantTestHost(SLUG_B);

  const created = await request(app.getHttpServer())
    .post("/api/v2/settings/tour-presets")
    .set("Host", hostA)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      name: "Hidden from B",
      formProfile: "general",
      defaults: {},
    })
    .expect(201);

  const presetId = created.body.id as string;

  const listB = await request(app.getHttpServer())
    .get("/api/v2/settings/tour-presets")
    .set("Host", hostB)
    .set("Authorization", `Bearer ${tokenB}`)
    .expect(200);

  const ids = (listB.body as Array<{ id: string }>).map((r) => r.id);
  assert.equal(ids.includes(presetId), false);
});

test("tenant B cannot GET preset by id from tenant A (404)", async () => {
  if (e2eUnavailableReason || !app) return;

  const hostA = tenantTestHost(SLUG_A);
  const hostB = tenantTestHost(SLUG_B);

  const created = await request(app.getHttpServer())
    .post("/api/v2/settings/tour-presets")
    .set("Host", hostA)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      name: "GET isolation preset",
      formProfile: "general",
      defaults: {},
    })
    .expect(201);

  const presetId = created.body.id as string;

  const getB = await request(app.getHttpServer())
    .get(`/api/v2/settings/tour-presets/${presetId}`)
    .set("Host", hostB)
    .set("Authorization", `Bearer ${tokenB}`);

  assert.equal(getB.status, 404);
  assert.equal(getB.body?.error?.code, "RESOURCE_NOT_FOUND");

  void hostA;
});
