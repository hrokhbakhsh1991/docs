/**
 * Bulk mutation + integration policy sync — Phase 5e static guards.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USERS_SERVICE = path.join(REPO_ROOT, "src/identity/users.service.ts");
const OPERATOR_AVATAR_STORAGE = path.join(
  REPO_ROOT,
  "src/identity/operator-avatar-storage.ts"
);
const INTEGRATIONS_SERVICE = path.join(
  REPO_ROOT,
  "src/integrations/http/integrations.service.ts"
);

describe("service-batch-patterns.spec.ts", () => {
  it("SVC-BATCH-01 runBulkMutation loads prefetch before loop", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/async function runBulkMutation\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /loadBulkUserMutationPrefetch/);
    assert.match(body, /mutate\(userId, prefetch\)/);
  });

  it("SVC-BATCH-02 patchIntegration delegates policy sync to infrastructure", () => {
    const source = fs.readFileSync(INTEGRATIONS_SERVICE, "utf8");
    const body = source.match(/export async function patchIntegration\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /syncIntegrationEventPoliciesInTransaction/);
    assert.doesNotMatch(body, /for\s*\([\s\S]*integrationEventPolicy\.upsert/);
  });

  it("SVC-BATCH-03 listUsersDirectory batch-resolves avatar URLs", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/export async function listUsersDirectory\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /directoryRowsFromPairs/);
    assert.doesNotMatch(body, /Promise\.all\(\s*pairs\.map\(async/);
  });

  it("SVC-BATCH-04 runBulkMutation batch-resolves avatar URLs via directoryRowsFromPairs", () => {
    const source = fs.readFileSync(USERS_SERVICE, "utf8");
    const body = source.match(/async function runBulkMutation\([\s\S]*?\n\}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /directoryRowsFromPairs\(successPairs\)/);
    assert.doesNotMatch(body, /toDirectoryRow/);
  });

  it("SVC-BATCH-05 resolveOperatorAvatarUrlsForMemberships read path skips bucket ensure", () => {
    const source = fs.readFileSync(OPERATOR_AVATAR_STORAGE, "utf8");
    const body = source.match(
      /export async function resolveOperatorAvatarUrlsForMemberships\([\s\S]*?\n\}/
    )?.[0];
    assert.ok(body !== undefined);
    assert.doesNotMatch(body, /ensureTenantBrandLogoBucket/);
  });
});
