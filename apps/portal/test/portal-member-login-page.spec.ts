import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal member login page — PCMS-03-LOGIN + MODAL", () => {
  it("PCMS-LOGIN-01 thin /login host auto-opens login modal", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/login/page.tsx"), "utf8");
    assert.match(page, /data-portal-member-login-page/);
    assert.match(page, /data-member-login-egress/);
    assert.match(page, /data-portal-return/);
    assert.match(page, /data-portal-login-thin-host/);
    assert.match(page, /PortalLoginModalOpener/);
    assert.match(page, /host="login"/);
    assert.match(page, /loginPageTitle/);
  });

  it("PCMS-LOGIN-01b missing login catalog tour does not notFound the host", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/login/page.tsx"), "utf8");
    assert.match(page, /fetchCatalogTour/);
    assert.match(page, /tour\?\.title/);
    assert.doesNotMatch(
      page,
      /fetchCatalogTour[\s\S]*?if \(tour === null\) \{\s*notFound\(\);/
    );
  });

  it("PCMS-LOGIN-02 register page redirects legacy portalReturn to /login", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/catalog/[tourId]/register/page.tsx"),
      "utf8"
    );
    assert.match(page, /redirect\(`\/login\?portalReturn=/);
  });

  it("PCMS-UX-MODAL-04 register guest gates auth to modal (no inline flow)", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/catalog/[tourId]/register/page.tsx"),
      "utf8"
    );
    const gate = readFileSync(
      join(repoRoot, "apps/portal/src/auth/portal-register-guest-auth-gate.tsx"),
      "utf8"
    );
    assert.match(page, /PortalRegisterGuestAuthGate/);
    assert.match(page, /PortalLoginModalOpener/);
    assert.match(page, /data-portal-register-guest-auth/);
    assert.match(page, /host="register"/);
    assert.match(gate, /data-portal-register-auth-gate/);
    assert.match(gate, /PortalRegisterSignInLink/);
    assert.match(gate, /\/api\/me\/profile/);
    assert.match(page, /registrationResume !== null \?/);
    assert.match(page, /: \(\s*<>[\s\S]*PortalLoginModalOpener[\s\S]*PortalRegisterGuestAuthGate/);
    assert.doesNotMatch(page, /initialRuntimeState=\{registrationResume\?\.initialState\}/);
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

  it("PCMS-LOGIN-05 flow receives SSR-stable memberLoginEgress prop (no window during render)", () => {
    const flow = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/public-catalog-registration-flow.tsx"),
      "utf8"
    );
    assert.match(flow, /memberLoginEgress/);
    // Location probe is allowed inside useEffect (client resume); must not gate render.
    assert.match(flow, /isMemberLoginEgressFromLocation/);
    assert.doesNotMatch(
      flow,
      /if \(isMemberLoginEgressFromLocation\(\)\) \{\s*return /
    );
  });

  it("PCMS-LOGIN-06 login egress omits registration stepper chrome", () => {
    const flow = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/public-catalog-registration-flow.tsx"),
      "utf8"
    );
    assert.match(flow, /showStepper = !memberLoginEgress/);
    assert.match(
      flow,
      /\{showStepper \? \(\s*<CatalogRegistrationStepper[\s\S]*?\) : null\}/
    );
  });

  it("MEM-LOGIN-MODAL-01 provider wires dialog hooks", () => {
    const modal = readFileSync(join(repoRoot, "apps/portal/src/auth/portal-login-modal.tsx"), "utf8");
    const providers = readFileSync(
      join(repoRoot, "apps/portal/src/shell/portal-providers.tsx"),
      "utf8"
    );
    assert.match(modal, /data-portal-login-modal/);
    assert.match(modal, /data-portal-login-modal-presentation/);
    assert.match(modal, /data-portal-login-modal-host/);
    assert.match(modal, /memberLoginStayOnPage/);
    assert.match(modal, /inert=\{!open\}/);
    assert.match(modal, /\{open \? \(/);
    assert.match(providers, /PortalLoginModalProvider/);
  });
});
