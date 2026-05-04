/**
 * Local auth audit for POST /api/v2/auth/web/session (DB + Argon2 + optional HTTP).
 * Run from apps/api: pnpm auth:debug-audit
 * Loads env via Node --env-file=.env (see package.json script).
 */
import * as argon2 from "argon2";
import bcrypt from "bcrypt";
import { DataSource, IsNull } from "typeorm";
import { createDataSourceOptionsFromEnv } from "../database/database.config";
import { Role } from "../modules/auth/roles.enum";
import { TenantEntity } from "../modules/identity/entities/tenant.entity";
import { UserEntity } from "../modules/identity/entities/user.entity";
import { UserTenantEntity } from "../modules/identity/entities/user-tenant.entity";

const EMAIL = "leader@test.com";
const PLAIN_PASSWORD = "demo123";
const TENANT_NAME = "demo-tenant";

function maskHash(hash: string): string {
  if (hash.length <= 16) {
    return `${hash.slice(0, 4)}…`;
  }
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

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

/** Mirrors AuthService.createWebSession checks before JWT (throws with reason string). */
async function simulateWebSessionValidation(params: {
  dataSource: DataSource;
  email: string;
  password: string;
  assertedTenantId: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const email = params.email.trim().toLowerCase();
  const userRepo = params.dataSource.getRepository(UserEntity);
  const membershipRepo = params.dataSource.getRepository(UserTenantEntity);

  const user = await userRepo.findOne({
    where: { email, deletedAt: IsNull() }
  });
  if (!user) {
    return { ok: false, reason: "AUTH_UNAUTHENTICATED (user not found)" };
  }

  let validPassword = false;
  try {
    validPassword = await argon2.verify(user.hashedPassword, params.password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `argon2.verify failed: ${msg}` };
  }
  if (!validPassword) {
    return { ok: false, reason: "AUTH_UNAUTHENTICATED (password mismatch)" };
  }

  const membership = await membershipRepo.findOne({
    where: {
      userId: user.id,
      tenantId: params.assertedTenantId,
      deletedAt: IsNull()
    }
  });
  if (!membership) {
    return { ok: false, reason: "TENANT_SCOPE_CONFLICT (no membership for asserted tenant)" };
  }

  return { ok: true };
}

async function httpLoginSession(baseUrl: string, tenantId: string): Promise<{
  ok: boolean;
  status?: number;
  session_token?: string;
  error?: string;
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/v2/auth/web/session`;
  const body = {
    entry_mode: "web" as const,
    credential: { email: EMAIL, password: PLAIN_PASSWORD },
    asserted_tenant_id: tenantId
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    return {
      ok: true,
      status: res.status,
      session_token: json.session_token
    };
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

  let userExists = false;
  let passwordMatchArgon = false;
  let bcryptMatch = false;
  let bcryptCompared = false;
  let role: string | undefined;
  let tenantIdForLogin: string | undefined;
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
          description: "Created by auth-debug-audit"
        })
      );
      console.log(`Created tenant name=${TENANT_NAME} id=${tenant.id}`);
    }
    tenantIdForLogin = tenant.id;

    let user = await userRepo.findOne({
      where: { email: EMAIL, deletedAt: IsNull() }
    });

    if (!user) {
      const hashedPassword = await argon2.hash(PLAIN_PASSWORD);
      user = await userRepo.save(
        userRepo.create({
          email: EMAIL,
          hashedPassword,
          fullName: "Audit Leader",
          isEmailVerified: true,
          telegramUserId: null
        })
      );
      console.log(`Created user ${EMAIL} id=${user.id}`);
    }

    userExists = true;

    const membershipRow = await membershipRepo.findOne({
      where: {
        userId: user.id,
        tenantId: tenant!.id,
        deletedAt: IsNull()
      }
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

    const membershipAfter = await membershipRepo.findOne({
      where: {
        userId: user.id,
        tenantId: tenant!.id,
        deletedAt: IsNull()
      }
    });
    role = membershipAfter?.role;

    console.log("\n--- Database snapshot ---");
    console.log(`id: ${user.id}`);
    console.log(`email: ${user.email}`);
    console.log(`role (membership): ${role ?? "(missing)"}`);
    console.log(`tenantId (UUID for asserted_tenant_id): ${tenant!.id}`);
    console.log(`tenant name: ${tenant!.name}`);
    console.log(`passwordHash (masked): ${maskHash(user.hashedPassword)}`);

    try {
      passwordMatchArgon = await argon2.verify(user.hashedPassword, PLAIN_PASSWORD);
    } catch (e) {
      console.log(`argon2.verify threw: ${e instanceof Error ? e.message : String(e)}`);
      passwordMatchArgon = false;
    }
    console.log(`argon2.verify("${PLAIN_PASSWORD}", storedHash): ${passwordMatchArgon}`);

    bcryptCompared = true;
    try {
      bcryptMatch = await bcrypt.compare(PLAIN_PASSWORD, user.hashedPassword);
    } catch {
      bcryptMatch = false;
    }
    console.log(
      `bcrypt.compare("${PLAIN_PASSWORD}", storedHash): ${bcryptMatch} (note: API uses Argon2; bcrypt here is diagnostic only)`
    );

    if (!passwordMatchArgon) {
      user.hashedPassword = await argon2.hash(PLAIN_PASSWORD);
      await userRepo.save(user);
      passwordMatchArgon = await argon2.verify(user.hashedPassword, PLAIN_PASSWORD);
      console.log(`Updated password hash with Argon2; verify now: ${passwordMatchArgon}`);
    }

    console.log("\n--- Internal validation (mirrors AuthService before JWT) ---");
    const internal = await simulateWebSessionValidation({
      dataSource,
      email: EMAIL,
      password: PLAIN_PASSWORD,
      assertedTenantId: tenant!.id
    });
    if (internal.ok) {
      console.log("Internal simulation: OK");
    } else {
      console.log(`Internal simulation: FAILED — ${internal.reason}`);
    }

    const port = process.env.PORT ?? "3000";
    const baseUrl = process.env.AUTH_AUDIT_API_BASE ?? `http://127.0.0.1:${port}`;
    console.log(`\n--- HTTP POST ${baseUrl}/api/v2/auth/web/session ---`);
    const http = await httpLoginSession(baseUrl, tenant!.id);
    if (http.ok && http.session_token) {
      console.log(`HTTP ${http.status}: OK, JWT length=${http.session_token.length}`);
      loginStatus = "success";
    } else {
      console.log(
        `HTTP failed: status=${http.status ?? "n/a"} error=${http.error ?? http.session_token ?? "unknown"}`
      );
      loginStatus = "failure";
      if (http.error?.includes("ECONNREFUSED")) {
        console.log("(API غیرفعال است؛ فقط منطق DB/argon2 بالا معتبر است.)");
      }
    }
  } finally {
    await dataSource.destroy();
  }

  console.log("\n========================================");
  console.log("AUTH DEBUG SUMMARY:");
  console.log(`- user exists: ${userExists ? "yes" : "no"}`);
  console.log(`- password match (argon2, canonical): ${passwordMatchArgon ? "yes" : "no"}`);
  console.log(
    `- password match (bcrypt diagnostic): ${bcryptCompared ? (bcryptMatch ? "yes" : "no") : "skipped"}`
  );
  console.log(`- role: ${role ?? "(unknown)"}`);
  console.log(`- tenantId (UUID): ${tenantIdForLogin ?? "(unknown)"}`);
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
