#!/usr/bin/env node
/**
 * PCMS-001 — portal-centric member session invariants.
 * @see docs/standards/member-session-portal-authority.mdoc
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const REQUIRED_FILES = [
  "docs/standards/member-session-portal-authority.mdoc",
  "apps/portal/src/catalog/build-registration-resume-initial-state.server.ts",
  "packages/tenant-kernel/src/host/resolve-member-session-cookie-domain.ts",
  "apps/marketing/src/shell/marketing-shell.tsx",
  "apps/marketing/src/auth/read-marketing-member-session.server.ts",
  "apps/marketing/src/shell/resolve-marketing-member-header.server.ts",
  "apps/portal/src/auth/apply-public-auth-cors.ts",
  "apps/portal/app/api/public-auth/session/route.ts",
  "packages/guest-surface-host/src/resolve-public-auth-cors-allow-origin.ts",
];

const MARKETING_SESSION_PROBE_ALLOWLIST = new Set([
  "apps/marketing/src/auth/read-marketing-member-session.server.ts",
]);

const PORTAL_CORS_ALLOWLIST = new Set([
  "apps/portal/middleware.ts",
  "apps/portal/src/auth/apply-public-auth-cors.ts",
]);

const FORBIDDEN_MARKETING_AUTH_HOST = [
  /createPortalSameOriginGuestAuthTransport/,
  /GuestAuthHostProvider/,
  /Access-Control-Allow-Origin/,
];

function readRepo(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function walkTsFiles(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return out;
  }
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTsFiles(full, out);
    } else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const rel of REQUIRED_FILES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) {
    violations.push(`missing required file: ${rel}`);
  }
}

const marketingShell = readRepo("apps/marketing/src/shell/marketing-shell.tsx");
if (!marketingShell.includes("data-marketing-portal-member")) {
  violations.push("marketing-shell.tsx: missing data-marketing-portal-member link");
}
if (!marketingShell.includes("portalMemberLoginUrl")) {
  violations.push("marketing-shell.tsx: missing portalMemberLoginUrl sign-in prop");
}
if (!marketingShell.includes("data-marketing-header-sign-in")) {
  violations.push("marketing-shell.tsx: missing data-marketing-header-sign-in");
}
if (!marketingShell.includes("data-marketing-header-member")) {
  violations.push("marketing-shell.tsx: missing data-marketing-header-member authenticated chip");
}
if (!marketingShell.includes("memberHeader")) {
  violations.push("marketing-shell.tsx: missing memberHeader prop");
}
if (marketingShell.includes("resolvePortalMemberAreaUrl")) {
  violations.push("marketing-shell.tsx: use resolvePortalMemberModuleUrl (PS-7 prep)");
}

const marketingLayout = readRepo("apps/marketing/app/layout.tsx");
if (!marketingLayout.includes("resolvePortalMemberLoginUrl")) {
  violations.push("marketing/app/layout.tsx: missing resolvePortalMemberLoginUrl");
}
if (!marketingLayout.includes("resolveMarketingMemberHeader")) {
  violations.push("marketing/app/layout.tsx: missing resolveMarketingMemberHeader");
}

const portalMiddleware = readRepo("apps/portal/middleware.ts");
if (!portalMiddleware.includes("validateSessionTokenAsync")) {
  violations.push("portal/middleware.ts: missing validateSessionTokenAsync (PCMS-SEC-02)");
}
if (!portalMiddleware.includes("resolvePortalBootstrapForHost")) {
  violations.push("portal/middleware.ts: missing bootstrap tenant bind");
}
if (!portalMiddleware.includes("redirectToMemberLogin")) {
  violations.push("portal/middleware.ts: unauthenticated /me/* must redirect to member login");
}
if (!portalMiddleware.includes("resolvePortalMemberLoginPath")) {
  violations.push("portal/middleware.ts: missing resolvePortalMemberLoginPath (PCMS-03)");
}
if (/register.*skip.*otp|skipOtp|skip_otp/i.test(portalMiddleware)) {
  violations.push("portal/middleware.ts: OTP skip forbidden in middleware");
}
if (!portalMiddleware.includes("resolvePublicAuthCorsAllowOrigin")) {
  violations.push("portal/middleware.ts: missing resolvePublicAuthCorsAllowOrigin (PCMS-CORS-02)");
}
if (!portalMiddleware.includes("isPortalPublicAuthApiPath")) {
  violations.push("portal/middleware.ts: missing isPortalPublicAuthApiPath (PCMS-CORS-01)");
}
if (!portalMiddleware.includes("OPTIONS") || !portalMiddleware.includes("applyPublicAuthCorsHeaders")) {
  violations.push("portal/middleware.ts: missing public-auth OPTIONS CORS (PCMS-CORS-04)");
}

const registerPage = readRepo("apps/portal/app/catalog/[tourId]/register/page.tsx");
if (!registerPage.includes("buildRegistrationResumeInitialState")) {
  violations.push("register/page.tsx: missing buildRegistrationResumeInitialState");
}

const portalSessionCookie = readRepo("apps/portal/src/auth/build-session-cookie.ts");
if (
  portalSessionCookie.includes('domain: ".localhost"') ||
  portalSessionCookie.includes('domain: "localhost"')
) {
  violations.push(
    "portal build-session-cookie: Domain=.localhost / Domain=localhost forbidden (PSL); use custom apex Domain via resolveMemberSessionCookieDomain"
  );
}
if (!portalSessionCookie.includes("resolveMemberSessionCookieDomain")) {
  violations.push(
    "portal build-session-cookie: missing resolveMemberSessionCookieDomain (PCMS-COOK-01 apex Domain)"
  );
}
if (!portalSessionCookie.includes("shouldRefreshDevMemberSessionCookieDomain")) {
  violations.push(
    "portal build-session-cookie: missing shouldRefreshDevMemberSessionCookieDomain (PCMS-COOK-03 apex refresh)"
  );
}

const forbiddenMarketingPatterns = [
  { re: /atour_mb_session/, label: "marketing must not reference atour_mb_session literal" },
  { re: /NEXT_PUBLIC_SESSION_COOKIE_DOMAIN/, label: "forbidden NEXT_PUBLIC_SESSION_COOKIE_DOMAIN" },
  { re: /validateSessionToken\s*\(/, label: "marketing must not use sync validateSessionToken" },
];

for (const root of ["apps/marketing/src", "apps/marketing/app"]) {
  const absRoot = path.join(REPO_ROOT, root);
  for (const file of walkTsFiles(absRoot)) {
    const rel = path.relative(REPO_ROOT, file);
    const content = readFileSync(file, "utf8");
    for (const { re, label } of forbiddenMarketingPatterns) {
      if (re.test(content)) {
        violations.push(`${rel}: ${label}`);
      }
    }
    if (
      /SESSION_COOKIE_NAMES\.member/.test(content) &&
      !MARKETING_SESSION_PROBE_ALLOWLIST.has(rel)
    ) {
      violations.push(`${rel}: member cookie read only allowed in read-marketing-member-session.server.ts`);
    }
    for (const re of FORBIDDEN_MARKETING_AUTH_HOST) {
      if (re.test(content)) {
        violations.push(`${rel}: Phase 4 forbids Marketing OTP host / CORS (${re})`);
      }
    }
  }
}

const pcmsDoc = readRepo("docs/standards/member-session-portal-authority.mdoc");
if (!pcmsDoc.includes("### 5.4 Marketing → Portal public-auth CORS")) {
  violations.push("PCMS-001 missing §5.4 public-auth CORS amendment");
}
if (!pcmsDoc.includes("PCMS-CORS-01")) {
  violations.push("PCMS-001 missing PCMS-CORS-01");
}

const corsHelper = readRepo("apps/portal/src/auth/apply-public-auth-cors.ts");
if (corsHelper.includes('Access-Control-Allow-Origin", "*"') || corsHelper.includes("Allow-Origin: *")) {
  violations.push("apply-public-auth-cors.ts: wildcard ACAO forbidden");
}
if (!corsHelper.includes('origin === "*"')) {
  violations.push("apply-public-auth-cors.ts: must refuse wildcard origin");
}

const sessionProbe = readRepo("apps/portal/app/api/public-auth/session/route.ts");
if (!sessionProbe.includes("ready")) {
  violations.push("public-auth/session: missing ready boolean (PCMS-CORS-05)");
}
if (/session_token|displayName/.test(sessionProbe)) {
  violations.push("public-auth/session: must not return token or profile PII");
}

for (const root of ["apps/portal/src", "apps/portal/app", "apps/portal"]) {
  const absRoot = path.join(REPO_ROOT, root);
  if (root === "apps/portal") {
    const mw = path.join(absRoot, "middleware.ts");
    if (statSync(mw, { throwIfNoEntry: false })?.isFile()) {
      const rel = "apps/portal/middleware.ts";
      const content = readFileSync(mw, "utf8");
      if (/Access-Control-Allow-Origin:\s*\*/.test(content)) {
        violations.push(`${rel}: wildcard ACAO forbidden`);
      }
    }
    continue;
  }
  for (const file of walkTsFiles(absRoot)) {
    const rel = path.relative(REPO_ROOT, file);
    const content = readFileSync(file, "utf8");
    if (!content.includes("Access-Control-Allow-Origin")) {
      continue;
    }
    if (!PORTAL_CORS_ALLOWLIST.has(rel)) {
      violations.push(`${rel}: CORS ACAO only allowed on public-auth helper + middleware`);
    }
    if (rel.includes("app/api/me/") || rel.includes("/api/me/")) {
      violations.push(`${rel}: CORS on /api/me/* forbidden (PCMS-CORS-01)`);
    }
    if (content.includes('Access-Control-Allow-Origin", "*"') || content.includes("Allow-Origin: *")) {
      violations.push(`${rel}: wildcard ACAO forbidden`);
    }
  }
}

const apiPublicAuth = path.join(REPO_ROOT, "apps/api/src/identity/public-auth.routes.ts");
if (statSync(apiPublicAuth, { throwIfNoEntry: false })?.isFile()) {
  const apiSrc = readFileSync(apiPublicAuth, "utf8");
  if (apiSrc.includes("Access-Control-Allow-Origin") || apiSrc.includes("Access-Control-Allow-Credentials")) {
    violations.push("apps/api public-auth must not grow browser CORS (PCMS-CORS-01)");
  }
}

if (violations.length > 0) {
  console.error("\nguard-pcms-authority — FAIL");
  for (const v of violations) {
    console.error(`  • ${v}`);
  }
  process.exit(1);
}

console.log("guard-pcms-authority — PASS");
