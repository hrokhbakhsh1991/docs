/**
 * PCMS-001 §5.5 — Marketing is an OTP UI host via Portal-origin transport only.
 * @see docs/standards/member-session-portal-authority.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isMarketingTourDetailPathname } from "../src/auth/is-marketing-tour-detail-pathname";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(marketingRoot, "../..");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return out;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(full, out);
    } else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("marketing Phase 5 — Portal-origin auth host", () => {
  it("MKT-PCMS-P5-01 origin adapter + shared steps; no same-origin factory or member BFF", () => {
    const files = [
      ...walkTsFiles(join(marketingRoot, "src")),
      ...walkTsFiles(join(marketingRoot, "app")),
    ];
    assert.ok(files.length > 0);
    const joined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    assert.match(joined, /tryCreatePortalOriginGuestAuthTransport/);
    assert.match(joined, /GuestAuthHostProvider/);
    assert.match(joined, /catalogRegistrationAuthFlowSteps/);
    assert.match(joined, /data-marketing-login-modal/);
    assert.doesNotMatch(joined, /createPortalSameOriginGuestAuthTransport/);
    assert.doesNotMatch(joined, /PublicCatalogRegistrationFlow/);
    assert.doesNotMatch(joined, /completeMemberLoginEgress/);
    assert.doesNotMatch(joined, /waitForMemberSessionCookie/);
    assert.doesNotMatch(joined, /\/api\/me\/profile/);
    assert.doesNotMatch(joined, /Access-Control-Allow-Origin/);
    assert.doesNotMatch(joined, /app\/api\/public-auth/);
    for (const file of files) {
      const rel = file.slice(repoRoot.length + 1);
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /atour_mb_session/, rel);
    }
  });

  it("MKT-PCMS-P5-02 header navigates to /login; PDP guest register + sign-in keep modal trigger", () => {
    const shell = readFileSync(join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    const trigger = readFileSync(
      join(marketingRoot, "src/auth/marketing-login-modal-trigger.tsx"),
      "utf8"
    );
    const cta = readFileSync(
      join(marketingRoot, "src/catalog/catalog-tour-detail-register-cta.tsx"),
      "utf8"
    );
    const modal = readFileSync(join(marketingRoot, "src/auth/marketing-login-modal.tsx"), "utf8");
    assert.doesNotMatch(shell, /MarketingLoginModalTrigger/);
    assert.match(shell, /href=\{portalMemberLoginUrl\}/);
    assert.match(trigger, /preventDefault/);
    assert.match(trigger, /data-marketing-register-ready/);
    assert.match(trigger, /data-marketing-register-modal/);
    assert.doesNotMatch(trigger, /canHostAuth/);
    assert.doesNotMatch(modal, /canHostAuth/);
    assert.match(cta, /data-marketing-tour-sign-in/);
    assert.match(cta, /MarketingLoginModalTrigger/);
    assert.match(cta, /host="pdp"/);
    assert.match(cta, /primaryKind === "register"/);
    assert.match(
      cta,
      /cta\.primaryKind === "register" \? \(\s*<MarketingLoginModalTrigger[\s\S]*?data-marketing-register/
    );
    assert.match(cta, /data-marketing-register/);
    assert.match(cta, /<a href=\{cta\.primaryHref\} data-marketing-register>/);
    assert.doesNotMatch(cta, /tryCreatePortalOriginGuestAuthTransport/);
    assert.match(modal, /isMarketingTourDetailPathname/);
    assert.match(modal, /host: "pdp"/);
    assert.match(modal, /data-marketing-login-unavailable/);
    assert.match(modal, /errors\.BACKEND_UNREACHABLE/);
  });

  it("MKT-PCMS-P5-05 marketing ?auth=login auto-open is PDP-only", () => {
    assert.equal(isMarketingTourDetailPathname("/tours/00000000-0000-4000-8000-000000000220"), true);
    assert.equal(isMarketingTourDetailPathname("/en/tours/abc"), true);
    assert.equal(isMarketingTourDetailPathname("/"), false);
    assert.equal(isMarketingTourDetailPathname("/tours"), false);
    assert.equal(isMarketingTourDetailPathname("/tours/"), false);
    assert.equal(isMarketingTourDetailPathname("/login"), false);
  });

  it("MKT-PCMS-P5-03 catalogRegistration messages exist without shenski", () => {
    for (const locale of ["fa", "en"] as const) {
      const raw = readFileSync(
        join(marketingRoot, `messages/${locale}/catalogRegistration.json`),
        "utf8"
      );
      assert.doesNotMatch(raw, /shenski/i);
      const data = JSON.parse(raw) as {
        loginPageTitle?: string;
        phone?: { loginTitle?: string };
        errors?: { network?: string; BACKEND_UNREACHABLE?: string };
      };
      assert.equal(typeof data.loginPageTitle, "string");
      assert.equal(typeof data.phone?.loginTitle, "string");
      assert.equal(typeof data.errors?.network, "string");
      assert.equal(typeof data.errors?.BACKEND_UNREACHABLE, "string");
      assert.doesNotMatch(data.errors?.BACKEND_UNREACHABLE ?? "", /catalogRegistration/);
    }
  });

  it("MKT-PCMS-P5-04 no marketing public-auth or member BFF routes", () => {
    assert.equal(statSync(join(marketingRoot, "app/api/public-auth"), { throwIfNoEntry: false }), undefined);
    assert.equal(statSync(join(marketingRoot, "app/api/me"), { throwIfNoEntry: false }), undefined);
  });
});
