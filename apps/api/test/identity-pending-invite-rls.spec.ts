/**
 * Identity pending invite RLS — static guards (Phase 5).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONOREPO_ROOT = path.resolve(REPO_ROOT, "../..");
const PRISMA_IDENTITY = path.join(
  REPO_ROOT,
  "src",
  "identity",
  "prisma-identity.repository.ts"
);
const MIGRATION = path.join(
  REPO_ROOT,
  "prisma",
  "migrations",
  "20260707110000_operator_pending_invites_rls",
  "migration.sql"
);
const GUARD_SCRIPT = path.join(MONOREPO_ROOT, "scripts", "guards", "guard-repository-rls.mjs");

describe("identity-pending-invite-rls.spec.ts", () => {
  it("ID-RLS-01 migration enables FORCE RLS on operator_pending_invites", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");
    assert.match(sql, /operator_pending_invites ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /operator_pending_invites FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /operator_pending_invites_tenant_isolation/);
  });

  it("ID-RLS-02 createPendingInvite uses withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async createPendingInvite\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /operatorPendingInvite\.create/);
    assert.doesNotMatch(body, /getPrisma\s*\(\s*\)\.operatorPendingInvite/);
  });

  it("ID-RLS-03 findPendingInviteByToken is tenant-scoped under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async findPendingInviteByToken\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /inviteToken.*tenantId/s);
  });

  it("ID-RLS-04 guard-repository-rls script exists", () => {
    assert.ok(fs.existsSync(GUARD_SCRIPT));
    const source = fs.readFileSync(GUARD_SCRIPT, "utf8");
    assert.match(source, /operatorPendingInvite/);
    assert.match(source, /withTenantRls/);
  });

  it("ID-RLS-05 updateUserMobile uses identity admin client for cross-tenant session bump", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async updateUserMobile\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /getIdentityAdminClient\s*\(/);
    assert.match(body, /IDENTITY_ADMIN_REASON\.ID_USER_WRITE/);
    assert.doesNotMatch(body, /tx\.userTenant\.updateMany/);
  });

  it("ID-RLS-06 guard-service-n-plus-one script exists", () => {
    const script = path.join(MONOREPO_ROOT, "scripts", "guards", "guard-service-n-plus-one.mjs");
    assert.ok(fs.existsSync(script));
    const source = fs.readFileSync(script, "utf8");
    assert.match(source, /LEGACY_ALLOWLIST/);
    assert.match(source, /QUERY_IN_LOOP_RE/);
  });

  it("ID-RLS-07 listMembershipsWithUsersByTenant joins user under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async listMembershipsWithUsersByTenant\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /user:\s*\{\s*select:/);
  });

  it("ID-RLS-08 listUsersDirectory uses batch membership+user repo method", () => {
    const usersService = path.join(REPO_ROOT, "src", "identity", "users.service.ts");
    const source = fs.readFileSync(usersService, "utf8");
    const body = source.match(/export async function listUsersDirectory\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /listMembershipsWithUsersDirectoryPage/);
    assert.doesNotMatch(body, /findUserById\s*\(\s*membership\.userId/);
  });
});
