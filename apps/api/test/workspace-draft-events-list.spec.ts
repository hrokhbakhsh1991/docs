/**
 * Workspace draft events SQL-bound list — AP15 P1.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_DRAFT_EVENTS = path.join(
  REPO_ROOT,
  "src/workspace-drafts/prisma-workspace-draft-events.repository.ts"
);

function extractAsyncMethodBody(source: string, methodName: string): string {
  const start = source.indexOf(`async ${methodName}(`);
  assert.ok(start >= 0, `${methodName} must exist`);
  const tail = source.slice(start);
  const nextMethod = tail.search(/\n  async [A-Za-z]/);
  return nextMethod > 0 ? tail.slice(0, nextMethod) : tail.slice(0, 1200);
}

describe("workspace-draft-events-list.spec.ts", () => {
  it("DRF-EVT-01 listByDraft uses take and orderBy in Prisma (no in-memory slice)", () => {
    const source = fs.readFileSync(PRISMA_DRAFT_EVENTS, "utf8");
    const body = extractAsyncMethodBody(source, "listByDraft");
    assert.match(body, /findMany/);
    assert.match(body, /take:\s*boundedLimit/);
    assert.match(body, /orderBy:\s*\[\{\s*occurredAt:\s*"desc"\s*\}/);
    assert.match(body, /select:\s*WORKSPACE_DRAFT_EVENT_LIST_SELECT/);
    assert.doesNotMatch(body, /\.slice\s*\(/);
  });

  it("DRF-EVT-02 service clamps draft events limit to 100", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "src/workspace-drafts/workspace-drafts.service.ts"),
      "utf8"
    );
    assert.match(source, /MAX_DRAFT_EVENTS_LIMIT\s*=\s*100/);
    assert.match(source, /clampWorkspaceDraftEventsLimit/);
  });
});
