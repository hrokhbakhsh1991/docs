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
    assert.match(page, /formatMemberRegistrationDeparture/);
    assert.match(page, /nextTourDepartureAt/);
  });

  it("PS5-HOME-03 optional dashboard sources cannot turn home into a global error", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/me/home/page.tsx"), "utf8");
    assert.match(page, /Promise\.allSettled/);
    assert.match(
      page,
      /registrationsOutcome\.status === "fulfilled" \? registrationsOutcome\.value : \[\]/
    );
    assert.match(page, /profileOutcome\.status === "fulfilled" \? profileOutcome\.value : null/);
    assert.match(
      page,
      /walletOutcome\.status === "fulfilled" \? walletOutcome\.value : \{ state: "error" \}/
    );
  });
});
