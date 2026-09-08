/**
 * Operator dead-route aliases — legacy paths must redirect, not 500.
 * @see docs/phase-20/p7/runbooks/p7-staging-e2e.md (staging flow audit 2026-09-08)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

const ROUTE_ALIAS_PAGES: ReadonlyArray<{ readonly path: string; readonly redirect: RegExp }> = [
  {
    path: "app/(app)/tours/[id]/page.tsx",
    redirect: /redirect\(workspaceBasePath\(tourId\)\)/,
  },
  {
    path: "app/(app)/tours/[id]/bookings/page.tsx",
    redirect: /redirect\(buildTourWorkspaceBookingsHref\(tourId\)\)/,
  },
  {
    path: "app/(app)/tours/[id]/workspace/bookings/page.tsx",
    redirect: /redirect\(buildTourWorkspaceBookingsHref\(tourId\)\)/,
  },
  {
    path: "app/(app)/workspace/registrations/page.tsx",
    redirect: /redirect\("\/tours"\)/,
  },
  {
    path: "app/(app)/workspace/bookings/page.tsx",
    redirect: /redirect\("\/bookings"\)/,
  },
  {
    path: "app/(app)/finance/hub/page.tsx",
    redirect: /redirect\("\/finance"\)/,
  },
  {
    path: "app/(app)/finance/receipts/page.tsx",
    redirect: /redirect\("\/finance\?tab=receipts"\)/,
  },
];

describe("tour-route-alias-pages.spec.ts — operator legacy route redirects", () => {
  it("alias pages redirect to canonical operator surfaces", () => {
    for (const { path, redirect } of ROUTE_ALIAS_PAGES) {
      const source = readFileSync(join(WEB_ROOT, path), "utf8");
      assert.match(source, redirect, `expected redirect in ${path}`);
      assert.doesNotMatch(source, /notFound\(/, `${path} must redirect, not 404`);
    }
  });
});
