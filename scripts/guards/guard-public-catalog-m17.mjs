#!/usr/bin/env node
/**
 * M17 public catalog OTP — fast static closure guard.
 * @see docs/workspaces/denali/public-catalog.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function assertCheck(name, ok, detail) {
  if (!ok) {
    failures.push(`${name}: ${detail}`);
    console.error(`FAIL ${name}: ${detail}`);
    return;
  }
  console.log(`PASS ${name}`);
}

const REQUIRED_FILES = [
  "apps/api/src/identity/public-auth.routes.ts",
  "apps/api/src/openapi/public-auth-openapi.ts",
  "apps/api/test/public-auth.spec.ts",
  "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx",
  "apps/portal/app/api/catalog/registrations/route.ts",
  "apps/portal/playwright.portal.config.ts",
  "apps/portal/tests/e2e/portal-registration-smoke.spec.ts",
  "apps/portal/tests/e2e/fixtures/catalog-registration-otp.ts",
  "apps/web/app/(public)/catalog/[tourId]/register/page.tsx",
  "apps/web/src/portal/resolve-portal-registration-redirect.ts",
  "apps/marketing/tests/e2e/marketing-catalog-smoke.spec.ts",
  "docs/workspaces/denali/public-catalog.md",
];

for (const rel of REQUIRED_FILES) {
  assertCheck(`m17_file_${path.basename(rel)}`, exists(rel), `missing ${rel}`);
}

const PORTAL_BFF_ROUTES = [
  "apps/portal/app/api/public-auth/phone-preflight/route.ts",
  "apps/portal/app/api/public-auth/request-otp/route.ts",
  "apps/portal/app/api/public-auth/verify-otp/route.ts",
  "apps/portal/app/api/public-auth/register-complete/route.ts",
  "apps/portal/app/api/public-auth/session-profile/route.ts",
];

for (const rel of PORTAL_BFF_ROUTES) {
  assertCheck(`m17_portal_bff_${path.basename(path.dirname(rel))}`, exists(rel), `missing ${rel}`);
}

const dispatch = read("apps/api/src/openapi/dispatch-routes.ts");
for (const route of [
  "/public/auth/phone-preflight",
  "/public/auth/request-otp",
  "/public/auth/verify-otp",
  "/public/auth/register/complete",
]) {
  assertCheck(`m17_dispatch_${route}`, dispatch.includes(route), `dispatch-routes missing ${route}`);
}

const openapiOverrides = read("apps/api/src/openapi/public-auth-openapi.ts");
for (const op of [
  "publicPhonePreflight",
  "publicRequestOtp",
  "publicVerifyOtp",
  "publicRegisterComplete",
]) {
  assertCheck(`m17_openapi_${op}`, openapiOverrides.includes(op), `public-auth-openapi missing ${op}`);
}

const webRegisterRedirect = read("apps/web/app/(public)/catalog/[tourId]/register/page.tsx");
assertCheck(
  "m17_web_register_redirects_to_portal",
  webRegisterRedirect.includes("resolvePortalRegistrationRedirectUrl"),
  "web /catalog/.../register must redirect to apps/portal (DEC-P11-014)"
);

const portalRegisterPage = read("apps/portal/app/catalog/[tourId]/register/page.tsx");
assertCheck(
  "m17_portal_register_bootstrap",
  portalRegisterPage.includes("resolvePortalBootstrapForHost"),
  "portal /catalog/.../register must resolve tenant bootstrap"
);

const portalVerifyOtpBff = read("apps/portal/app/api/public-auth/verify-otp/route.ts");
assertCheck(
  "m17_portal_verify_otp_sets_session_cookie",
  portalVerifyOtpBff.includes("setSessionCookieOnResponse"),
  "portal verify-otp BFF must set session cookie on success"
);

const portalRegistrations = read("apps/portal/app/api/catalog/registrations/route.ts");
assertCheck(
  "m17_portal_intake_denali_and_urban",
  portalRegistrations.includes("/denali/registrations") &&
    portalRegistrations.includes("/urban/registrations"),
  "portal catalog registrations BFF must dispatch denali + urban"
);

const publicCatalogDoc = read("docs/workspaces/denali/public-catalog.md");
assertCheck(
  "m17_doc_smoke_ids",
  publicCatalogDoc.includes("SMK-DREG-01") &&
    publicCatalogDoc.includes("SMK-MKT-03") &&
    publicCatalogDoc.includes("SMK-PTL-01"),
  "public-catalog.md must document SMK-DREG-01, SMK-MKT-03, and SMK-PTL-01"
);

assertCheck(
  "m17_next_workspaces_slug_unambiguous",
  !exists("apps/web/app/api/workspaces/[tenantId]"),
  "remove apps/web/app/api/workspaces/[tenantId] — conflicts with [workspaceId] (Next.js dynamic slug)"
);

if (failures.length > 0) {
  console.error(`\nguard-public-catalog-m17 — ${failures.length} FAIL`);
  process.exit(1);
}

const passTotal = REQUIRED_FILES.length + PORTAL_BFF_ROUTES.length + 11;
console.log(`\nguard-public-catalog-m17 — ${passTotal}/${passTotal} PASS`);
