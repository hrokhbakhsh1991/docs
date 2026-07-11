/**
 * Settings audit trail list projection — AP15 P1 bounded findMany.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_AUDIT = path.join(REPO_ROOT, "src/settings/prisma-settings-audit.repository.ts");

function extractAsyncMethodBody(source: string, methodName: string): string {
  const start = source.indexOf(`async ${methodName}(`);
  assert.ok(start >= 0, `${methodName} must exist`);
  const tail = source.slice(start);
  const nextMethod = tail.search(/\n  async [A-Za-z]/);
  return nextMethod > 0 ? tail.slice(0, nextMethod) : tail.slice(0, 1200);
}

describe("settings-audit-list-projection.spec.ts", () => {
  it("SET-AUD-01 listByTenantPage uses select, take, and keyset order under withTenantRls", () => {
    const source = fs.readFileSync(PRISMA_AUDIT, "utf8");
    const body = extractAsyncMethodBody(source, "listByTenantPage");
    assert.match(body, /withTenantRls\s*\(/);
    assert.match(body, /select:\s*SETTINGS_AUDIT_LIST_SELECT/);
    assert.match(body, /take:\s*limit\s*\+\s*1/);
    assert.match(body, /orderBy:\s*\[\{\s*occurredAt:\s*"desc"\s*\}/);
  });

  it("SET-AUD-02 listByTenant delegates to bounded page (no raw findMany)", () => {
    const source = fs.readFileSync(PRISMA_AUDIT, "utf8");
    const body = extractAsyncMethodBody(source, "listByTenant");
    assert.match(body, /listByTenantPage\s*\(/);
    assert.match(body, /MAX_SETTINGS_AUDIT_EVENTS_PER_TENANT/);
    assert.doesNotMatch(body, /findMany/);
  });

  it("SET-AUD-03 projection module exports cap and select", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "src/settings/settings-audit-list-projection.ts"),
      "utf8"
    );
    assert.match(source, /MAX_SETTINGS_AUDIT_EVENTS_PER_TENANT\s*=\s*500/);
    assert.match(source, /SETTINGS_AUDIT_LIST_SELECT/);
    assert.doesNotMatch(source, /credentials/);
  });
});
