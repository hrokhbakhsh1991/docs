/**
 * DP-4 — portal member cancellation contract.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("DP4 portal member cancellation contract", () => {
  it("detail page renders cancel eligibility shell", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/page.tsx"),
      "utf8"
    );
    assert.match(page, /MemberCancellationPanel/);
    const panel = readFileSync(
      join(repoRoot, "apps/portal/app/me/registrations/[id]/member-cancellation-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /data-portal-member-cancel/);
  });

  it("BFF exposes member cancellation route", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/registrations/[id]/cancellation/route.ts"),
      "utf8"
    );
    assert.match(route, /member-cancellation/);
  });

  it("notifications inbox route exists", () => {
    const route = readFileSync(
      join(repoRoot, "apps/portal/app/api/me/notifications/route.ts"),
      "utf8"
    );
    assert.match(route, /member\/notifications/);
  });
});
