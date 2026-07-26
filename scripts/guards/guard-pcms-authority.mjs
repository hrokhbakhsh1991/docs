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
];

const MARKETING_SESSION_PROBE_ALLOWLIST = new Set([
  "apps/marketing/src/auth/read-marketing-member-session.server.ts",
]);

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
