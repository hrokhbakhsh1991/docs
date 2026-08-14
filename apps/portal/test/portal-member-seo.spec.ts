/**
 * PS-4 — portal SEO crawl boundary static checks
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(portalRoot, "../..");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-member-seo.spec.ts — PS-4", () => {
  it("PS4-SEO-01 robots.ts disallows /api/", () => {
    const robots = readFileSync(join(portalRoot, "app/robots.ts"), "utf8");
    assert.match(robots, /\/api\//);
  });

  it("PS4-SEO-02 me layout sets noindex metadata", () => {
    const layout = readPortal("app/me/layout.tsx");
    assert.match(layout, /robots:/);
    assert.match(layout, /index: false/);
  });

  it("PS4-SEO-03 register page sets noindex metadata", () => {
    const page = readPortal("app/catalog/[tourId]/register/page.tsx");
    assert.match(page, /robots:/);
    assert.match(page, /index: false/);
  });

  it("PS4-SEO-04 registration flow injects memberModuleHref", () => {
    const page = readPortal("app/catalog/[tourId]/register/page.tsx");
    assert.match(page, /resolvePortalMemberModuleUrl/);
    assert.match(page, /memberModuleHref/);
    const flow = readPortal("src/catalog/public-catalog-registration-flow.tsx");
    assert.match(flow, /memberModuleHref/);
  });
});

describe("portal-member-seo.spec.ts — workspace egress", () => {
  it("PS4-EGRESS-01 denali done step uses context.memberModuleHref", () => {
    const denaliDone = readFileSync(
      join(repoRoot, "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"),
      "utf8"
    );
    assert.match(denaliDone, /context\.memberModuleHref/);
    assert.doesNotMatch(denaliDone, /href="\/me\/registrations"/);
    assert.match(denaliDone, /data-registration-self-already-trips/);
    assert.match(denaliDone, /data-registration-self-already-detail/);
  });
});
