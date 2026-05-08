/**
 * Local audit for phone + OTP web login (`POST /api/v2/auth/web/session/otp`).
 * Run from apps/api: pnpm auth:debug-audit
 */
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { Role } from "../modules/auth/roles.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const EMAIL = "leader@test.com";
const PHONE = "+15551234567";
const STATIC_OTP = "1234";
const TENANT_NAME = "demo-tenant";

function assertDbEnv(): void {
  const keys = ["DATABASE_HOST", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"] as const;
  for (const k of keys) {
    const v = process.env[k];
    if (v === undefined || v === "") {
      throw new Error(`Missing env ${k}. Use apps/api/.env (see .env.example).`);
    }
    if (k === "DATABASE_PASSWORD" && typeof v !== "string") {
      throw new Error("DATABASE_PASSWORD must be a string");
    }
  }
}

async function simulateOtpSessionChecks(params: {
  dataSource: DataSource;
  phone: string;
  otp: string;
  tenantId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, reason: "static OTP checks disabled in production NODE_ENV" };
  }
  if (params.otp !== STATIC_OTP) {
    return { ok: false, reason: "AUTH_UNAUTHENTICATED (OTP mismatch for non-production static policy)" };
  }
  const user = await params.dataSource
    .getRepository(UserEntity)
    .createQueryBuilder("u")
    .where("u.deleted_at IS NULL")
    .andWhere("phone_normalized(u.phone) = phone_normalized(:phone)", { phone: params.phone.trim() })
    .getOne();
  if (!user) {
    return { ok: false, reason: "AUTH_UNAUTHENTICATED (no user for normalized phone)" };
  }
  const membership = await params.dataSource.getRepository(UserTenantEntity).findOne({
    where: { userId: user.id, tenantId: params.tenantId, deletedAt: IsNull() }
  });
  if (!membership) {
    return { ok: false, reason: "TENANT_SCOPE_FORBIDDEN (no membership for tenant)" };
  }
  return { ok: true };
}

async function httpLoginSession(baseUrl: string, hostHeader: string): Promise<{
  ok: boolean;
  status?: number;
  session_token?: string;
  error?: string;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v2/auth/web/session/otp`;
  const body = { phone: PHONE, otp: STATIC_OTP };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: hostHeader },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json: { session_token?: string } = {};
    try {
      json = JSON.parse(text) as { session_token?: string };
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status, session_token: json.session_token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

async function run(): Promise<void> {
  assertDbEnv();

  const dataSource = new DataSource({
    ...createDataSourceOptionsFromEnv(),
    entities: [TenantEntity, UserEntity, UserTenantEntity]
  });

  await dataSource.initialize();

  let loginStatus: "success" | "failure" = "failure";

  try {
    const tenantRepo = dataSource.getRepository(TenantEntity);
    const userRepo = dataSource.getRepository(UserEntity);
    const membershipRepo = dataSource.getRepository(UserTenantEntity);

    let tenant = await tenantRepo.findOne({
      where: { name: TENANT_NAME, deletedAt: IsNull() }
    });
    if (!tenant) {
      tenant = await tenantRepo.save(
        tenantRepo.create({
          name: TENANT_NAME,
          description: "Created by auth-debug-audit",
          subdomain: "demo"
        })
      );
      console.log(`Created tenant name=${TENANT_NAME} id=${tenant.id}`);
    } else if (!tenant.subdomain?.trim()) {
      tenant.subdomain = "demo";
      await tenantRepo.save(tenant);
    }

    let user = await userRepo.findOne({
      where: { email: EMAIL, deletedAt: IsNull() }
    });

    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          email: EMAIL,
          phone: PHONE,
          isPhoneVerified: true,
          hashedPassword: await argon2.hash(`fixture-${randomUUID()}`),
          fullName: "Audit Leader",
          isEmailVerified: true,
          telegramUserId: null
        })
      );
      console.log(`Created user ${EMAIL} id=${user.id}`);
    } else if (!user.phone?.trim()) {
      user.phone = PHONE;
      user.isPhoneVerified = true;
      await userRepo.save(user);
      console.log(`Set phone on user ${user.id}`);
    }

    const membershipRow = await membershipRepo.findOne({
      where: { userId: user.id, tenantId: tenant!.id, deletedAt: IsNull() }
    });
    if (!membershipRow) {
      await membershipRepo.save(
        membershipRepo.create({
          tenantId: tenant!.id,
          userId: user.id,
          role: Role.OWNER
        })
      );
      console.log(`Created membership owner for ${EMAIL} on tenant ${tenant!.id}`);
    }

    console.log("\n--- Database snapshot ---");
    console.log(`id: ${user.id}`);
    console.log(`email: ${user.email}`);
    console.log(`phone: ${user.phone ?? "(unset)"}`);
    console.log(`tenantId: ${tenant!.id}`);
    console.log(`tenant subdomain: ${tenant!.subdomain ?? "(unset)"}`);

    console.log("\n--- Internal validation (OTP + membership, non-production) ---");
    const internal = await simulateOtpSessionChecks({
      dataSource,
      phone: PHONE,
      otp: STATIC_OTP,
      tenantId: tenant!.id
    });
    if (internal.ok) {
      console.log("Internal simulation: OK");
    } else {
      console.log(`Internal simulation: FAILED — ${internal.reason}`);
    }

    const port = process.env.PORT ?? "3000";
    const baseUrl = process.env.AUTH_AUDIT_API_BASE ?? `http://127.0.0.1:${port}`;
    console.log(`\n--- HTTP POST ${baseUrl}/api/v2/auth/web/session/otp ---`);
    const tenantRoot = process.env.TENANT_ROOT_DOMAIN?.trim() || "localhost";
    const slug = tenant!.subdomain?.trim() || "demo";
    const hostHeader =
      tenantRoot === "localhost" ? `${slug}.localhost` : `${slug}.${tenantRoot}`;
    const http = await httpLoginSession(baseUrl, hostHeader);
    if (http.ok && http.session_token) {
      console.log(`HTTP ${http.status}: OK, JWT length=${http.session_token.length}`);
      loginStatus = "success";
    } else {
      console.log(
        `HTTP failed: status=${http.status ?? "n/a"} error=${http.error ?? http.session_token ?? "unknown"}`
      );
      loginStatus = "failure";
      if (http.error?.includes("ECONNREFUSED")) {
        console.log("(API unreachable; DB checks above are still valid.)");
      }
    }
  } finally {
    await dataSource.destroy();
  }

  console.log("\n========================================");
  console.log("AUTH DEBUG SUMMARY (phone + OTP):");
  console.log(`- login status: ${loginStatus}`);
  console.log("========================================\n");
}

run().catch((error: unknown) => {
  console.error(
    "auth-debug-audit failed:",
    error instanceof Error ? error.stack ?? error.message : String(error)
  );
  process.exitCode = 1;
});
