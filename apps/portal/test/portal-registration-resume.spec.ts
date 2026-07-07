import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal registration resume — PCMS-REG-01", () => {
  it("PCMS-REG-01 register page builds resume state server-side", () => {
    const page = readFileSync(
      join(repoRoot, "apps/portal/app/catalog/[tourId]/register/page.tsx"),
      "utf8"
    );
    assert.match(page, /buildRegistrationResumeInitialState/);
    assert.match(page, /data-registration-resume/);
    assert.match(page, /initialRuntimeState/);
  });

  it("PCMS-REG-02 flow accepts initialRuntimeState from server", () => {
    const flow = readFileSync(
      join(
        repoRoot,
        "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx"
      ),
      "utf8"
    );
    assert.match(flow, /initialRuntimeState/);
    assert.doesNotMatch(flow, /request-otp/);
  });

  it("PCMS-REG-03 resume helper lives in portal catalog server module", () => {
    const helper = readFileSync(
      join(repoRoot, "apps/portal/src/catalog/build-registration-resume-initial-state.server.ts"),
      "utf8"
    );
    assert.match(helper, /currentStep: "intake"/);
    assert.match(helper, /readPublicCatalogSessionFromCookies/);
    assert.match(helper, /fetchMemberProfileFromSession/);
  });

  it("PCMS-REG-04 middleware uses async bootstrap tenant bind", () => {
    const middleware = readFileSync(join(repoRoot, "apps/portal/middleware.ts"), "utf8");
    assert.match(middleware, /export async function middleware/);
    assert.match(middleware, /resolvePortalBootstrapForHost/);
    assert.match(middleware, /resolvedPortalTenantId/);
  });
});
