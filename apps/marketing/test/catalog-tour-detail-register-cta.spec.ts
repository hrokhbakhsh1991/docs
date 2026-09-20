import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("catalog-tour-detail-register-cta — PCMS tour sign-in + Phase 3", () => {
  it("MKT-PCMS-P6-01 guest register uses modal trigger; continue stays a portal anchor", () => {
    const cta = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-register-cta.tsx"),
      "utf8"
    );
    assert.match(cta, /primaryKind === "register"/);
    assert.match(
      cta,
      /cta\.primaryKind === "register" && pdpAuthModalHref !== null \? \(\s*<MarketingLoginModalTrigger[\s\S]*?data-marketing-register/
    );
    assert.match(cta, /resolveMarketingTourDetailAuthModalHref/);
    assert.match(cta, /href=\{pdpAuthModalHref\}/);
    assert.match(cta, /<a href=\{cta\.primaryHref\} data-marketing-register>/);
    assert.match(cta, /data-marketing-view-registration/);
    assert.doesNotMatch(cta, /data-marketing-header-sign-in/);
  });

  it("MKT-PCMS-03 exposes secondary tour sign-in link for guests", () => {
    const cta = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-register-cta.tsx"),
      "utf8"
    );
    assert.match(cta, /data-marketing-tour-sign-in/);
    assert.match(cta, /MarketingLoginModalTrigger/);
    assert.match(cta, /signInToRegister/);
    assert.match(cta, /secondaryKind === "sign-in"/);
  });

  it("MKT-PCMS-P3-06 hides sign-in unless secondaryKind is sign-in", () => {
    const cta = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-register-cta.tsx"),
      "utf8"
    );
    assert.match(cta, /data-marketing-view-registration/);
    assert.match(cta, /data-marketing-register-another/);
    assert.match(cta, /data-marketing-tour-detail-cta-mode/);
    assert.doesNotMatch(cta, /tourSignInUrl/);
  });

  it("MKT-PCMS-P3-07 sticky and rail reuse the shared CTA", () => {
    const sticky = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-sticky-bar.tsx"),
      "utf8"
    );
    const rail = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-booking-rail.tsx"),
      "utf8"
    );
    assert.match(sticky, /CatalogTourDetailRegisterCta/);
    assert.doesNotMatch(sticky, /data-marketing-tour-sign-in/);
    assert.match(rail, /CatalogTourDetailRegisterCta/);
  });

  it("MKT-PCMS-P3-08 marketing for-tour SSR never uses portal member BFF", () => {
    const fetchSrc = readFileSync(
      join(
        repoRoot,
        "apps/marketing/src/catalog/fetch-marketing-member-self-registration-for-tour.server.ts"
      ),
      "utf8"
    );
    assert.match(fetchSrc, /tryResolveCatalogRegistrationForTourApiPath/);
    assert.match(fetchSrc, /Authorization: `Bearer/);
    assert.match(fetchSrc, /x-user-id/);
    assert.doesNotMatch(fetchSrc, /\/api\/me\/registrations/);
    assert.doesNotMatch(fetchSrc, /portal.*\/api\/me/);
    assert.doesNotMatch(fetchSrc, /@app-tour\/workspace-denali/);
  });

  it("MKT-PCMS-P3-09 fa/en define Phase 3 CTA labels", () => {
    const fa = JSON.parse(
      readFileSync(join(repoRoot, "apps/marketing/messages/fa/catalog.json"), "utf8")
    ) as { detail: Record<string, string> };
    const en = JSON.parse(
      readFileSync(join(repoRoot, "apps/marketing/messages/en/catalog.json"), "utf8")
    ) as { detail: Record<string, string> };
    for (const key of ["continueRegister", "viewMyRegistration", "registerAnotherGuest"]) {
      assert.equal(typeof fa.detail[key], "string");
      assert.ok(fa.detail[key].trim().length > 0);
      assert.equal(typeof en.detail[key], "string");
      assert.ok(en.detail[key].trim().length > 0);
    }
    assert.doesNotMatch(JSON.stringify(fa), /shenski/i);
    assert.doesNotMatch(JSON.stringify(en), /shenski/i);
  });

  it("MKT-PCMS-P3-12 Denali skin treats view-registration as primary and register-another as secondary", () => {
    const skin = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/theme/marketing/components/36-mkt-tour-sign-in-cta.css"
      ),
      "utf8"
    );
    const primary = readFileSync(
      join(repoRoot, "packages/workspaces/denali/theme/marketing/components/02-pr-d6-p1.css"),
      "utf8"
    );
    assert.match(skin, /data-marketing-view-registration/);
    assert.match(skin, /data-marketing-register-another/);
    assert.match(skin, /data-marketing-catalog-detail-sticky-cta/);
    assert.match(primary, /data-marketing-register\]:not\(\[data-marketing-register-another\]\)/);
  });

  it("MKT-PCMS-P3-11 tour detail page resolves CTA from session-aware server helper", () => {
    const page = readFileSync(
      join(repoRoot, "apps/marketing/app/tours/[tourId]/page.tsx"),
      "utf8"
    );
    assert.match(page, /resolveMarketingTourDetailCta/);
    assert.match(page, /cta=\{cta\}/);
  });
});
