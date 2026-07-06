/**
 * PS-5 — portal home redirect + /me/home route
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-home-redirect — PS-5", () => {
  it("PS5-HOME-01 session redirects via registry defaultPrimaryModuleId", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/page.tsx"), "utf8");
    assert.match(page, /readPublicCatalogSessionFromCookies/);
    assert.match(page, /tryResolveMemberPortalDefaultRoutePath/);
    assert.doesNotMatch(page, /redirect\("\/me\/registrations"\)/);
  });

  it("PS5-HOME-02 /me/home page SSR marker", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/home/page.tsx"), "utf8");
    assert.match(page, /data-portal-member-home/);
    assert.match(page, /buildMemberHomePayload/);
  });
});
