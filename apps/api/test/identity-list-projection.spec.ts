/**
 * Identity list projection guards — AP15 bounded findMany.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_IDENTITY = path.join(REPO_ROOT, "src/identity/prisma-identity.repository.ts");

describe("identity-list-projection.spec.ts", () => {
  it("ID-LIST-01 listMembershipsByTenant uses select and take under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async listMembershipsByTenant\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /select:\s*MEMBERSHIP_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_IDENTITY_MEMBERSHIPS_PER_TENANT/);
  });

  it("ID-LIST-02 listPendingInvitesByTenant uses select and take under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async listPendingInvitesByTenant\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /select:\s*PENDING_INVITE_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_PENDING_INVITES_PER_TENANT/);
  });

  it("ID-LIST-03 findPendingInviteByPhone uses findFirst not list scan", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async findPendingInviteByPhone\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /findFirst/);
    assert.match(body, /withTenantRls\s*\(/);
    assert.doesNotMatch(body, /findMany/);
  });
});
