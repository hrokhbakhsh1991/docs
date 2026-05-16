#!/usr/bin/env node
/**
 * Automated slice of docs/security/csrf-xss-baseline-checklist.md (Phase 5.2 helpers).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function fail(msg) {
  console.error(`[security-baseline] FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`[security-baseline] OK: ${msg}`);
}

let failures = 0;
function check(condition, passMsg, failMsg) {
  if (condition) {
    ok(passMsg);
  } else {
    fail(failMsg);
    failures += 1;
  }
}

console.log("[security-baseline] Static checks\n");

const mainTs = read("apps/api/src/main.ts");
check(!/origin:\s*true/.test(mainTs), "API CORS not origin:true", "API main.ts uses origin:true");

const webApp = path.join(root, "apps/web/app");
let dangerous = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(p);
    } else if (/\.(tsx|jsx)$/.test(ent.name) && fs.readFileSync(p, "utf8").includes("dangerouslySetInnerHTML")) {
      dangerous += 1;
    }
  }
}
walk(webApp);
check(dangerous === 0, "no dangerouslySetInnerHTML in apps/web/app", `found ${dangerous} dangerouslySetInnerHTML usages`);

const sessionCookie = read("apps/web/lib/auth/build-session-cookie.ts");
check(
  sessionCookie.includes("httpOnly: true"),
  "session cookie builder sets httpOnly",
  "build-session-cookie.ts missing httpOnly",
);

const bffAuth = [
  "apps/web/app/api/auth/request-otp/route.ts",
  "apps/web/app/api/auth/login-web-session/route.ts",
].filter((f) => fs.existsSync(path.join(root, f)));

for (const f of bffAuth) {
  const src = read(f);
  check(
    src.includes("bffGuardErrorResponse") || src.includes("proxyBff"),
    `${f} uses BFF guard/proxy`,
    `${f} missing BFF guard`,
  );
}

console.log(`\n[security-baseline] Done (${failures} failure(s))`);
process.exit(failures > 0 ? 1 : 0);
