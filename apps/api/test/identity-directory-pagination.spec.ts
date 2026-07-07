/**
 * Identity directory DB pagination — AP15 P3.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_IDENTITY = path.join(REPO_ROOT, "src/identity/prisma-identity.repository.ts");
const USERS_SERVICE = path.join(REPO_ROOT, "src/identity/users.service.ts");

describe("identity-directory-pagination.spec.ts", () => {
  it("ID-DIR-01 countMembershipsDirectory uses SQL count with filter where", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async countMembershipsDirectory\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /buildUserTenantDirectoryWhere/);
    assert.match(body, /userTenant\.count/);
  });

  it("ID-DIR-02 listMembershipsWithUsersDirectoryPage uses skip/take or raw LIMIT", () => {
    const source = fs.readFileSync(PRISMA_IDENTITY, "utf8");
    const body = source.match(/async listMembershipsWithUsersDirectoryPage\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /take:\s*limit/);
    assert.match(body, /LIMIT \$\{limit\} OFFSET \$\{skip\}/);
  });

  it("ID-DIR-03 listUsersDirectory delegates pagination to repository", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/export async function listUsersDirectory\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /countMembershipsDirectory/);
    assert.match(body, /listMembershipsWithUsersDirectoryPage/);
    assert.doesNotMatch(body, /listMembershipsByTenant/);
  });

  it("ID-DIR-04 listUsersDirectory builds rows via directoryRowsFromPairs", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/export async function listUsersDirectory\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /directoryRowsFromPairs\(pairs\)/);
  });
});
