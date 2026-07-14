import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal member login page — PCMS-03-LOGIN", () => {
  it("PCMS-LOGIN-01 dedicated /login route exists", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/login/page.tsx"), "utf8");
    assert.match(page, /PortalAuthExperienceShell/);
    assert.match(page, /pageKind="login"/);
    assert.match(page, /loginPageTitle/);
    assert.match(page, /PublicCatalogRegistrationFlow/);
    assert.match(page, /memberLoginEgress/);
  });

  it("PCMS-LOGIN-02 register page redirects portalReturn to /login", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/catalog/[tourId]/register/page.tsx"),
      "utf8"
    );
    assert.match(page, /redirect\(`\/login\?portalReturn=/);
    assert.doesNotMatch(page, /data-member-login-egress/);
  });

  it("PCMS-LOGIN-03 shared auth shell exposes stable data hooks", () => {
    const shell = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/portal-auth-experience-shell.tsx"),
      "utf8"
    );
    assert.match(shell, /data-portal-auth-backdrop/);
    assert.match(shell, /data-portal-auth-card/);
    assert.match(shell, /data-portal-auth-hero/);
    assert.match(shell, /data-catalog-registration-page/);
    assert.match(shell, /data-portal-member-login-page/);
  });

  it("PCMS-LOGIN-04 login page canonicalizes portalReturn and redirects existing session", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/login/page.tsx"), "utf8");
    assert.match(page, /resolvePortalMemberLoginPath/);
    assert.match(page, /readPublicCatalogSessionFromCookies/);
    assert.match(page, /"data-portal-return": portalReturn/);
  });
});
