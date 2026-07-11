/**
 * Integration list projection — AP15 P1 (no credentials on list paths).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_CONNECTION = path.join(
  REPO_ROOT,
  "src/integrations/infrastructure/prisma-integration-connection.repository.ts"
);
const PRISMA_POLICY = path.join(
  REPO_ROOT,
  "src/integrations/infrastructure/prisma-integration-policy.repository.ts"
);

function extractAsyncMethodBody(source: string, methodName: string): string {
  const start = source.indexOf(`async ${methodName}(`);
  assert.ok(start >= 0, `${methodName} must exist`);
  const tail = source.slice(start);
  const nextMethod = tail.search(/\n  async [A-Za-z]/);
  return nextMethod > 0 ? tail.slice(0, nextMethod) : tail.slice(0, 1200);
}

describe("integration-list-projection.spec.ts", () => {
  it("INT-LIST-01 listForWorkspace excludes credentials and uses take", () => {
    const source = fs.readFileSync(PRISMA_CONNECTION, "utf8");
    const body = extractAsyncMethodBody(source, "listForWorkspace");
    assert.match(body, /select:\s*INTEGRATION_CONNECTION_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE/);
    assert.doesNotMatch(body, /credentials:\s*true/);
  });

  it("INT-LIST-02 listEnabledConnectionsForScope uses list select and take", () => {
    const source = fs.readFileSync(PRISMA_POLICY, "utf8");
    const body = extractAsyncMethodBody(source, "listEnabledConnectionsForScope");
    assert.match(body, /select:\s*INTEGRATION_CONNECTION_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_INTEGRATION_CONNECTIONS_PER_WORKSPACE/);
  });

  it("INT-LIST-03 listPoliciesForConnection uses policy select and take", () => {
    const source = fs.readFileSync(PRISMA_POLICY, "utf8");
    const body = extractAsyncMethodBody(source, "listPoliciesForConnection");
    assert.match(body, /select:\s*INTEGRATION_EVENT_POLICY_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_INTEGRATION_EVENT_POLICIES_PER_CONNECTION/);
  });
});
